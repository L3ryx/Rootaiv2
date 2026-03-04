require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static("public"));

/*
====================================================
UTILS
====================================================
*/

function toBase64(buffer) {
  return buffer.toString("base64");
}

function similarityPercent(score) {
  return Math.round(score * 100);
}

/*
====================================================
IMAGE COMPARISON VIA OPENAI
====================================================
*/

async function compareImages(base64A, base64B) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Return similarity score between 0 and 1 for these two product images." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64A}` } },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64B}` } }
            ]
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const text = response.data.choices[0].message.content;
    const match = text.match(/0\.\d+|1(\.0+)?/);
    return match ? parseFloat(match[0]) : 0;

  } catch {
    return 0;
  }
}

/*
====================================================
PIPELINE
====================================================
*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  const results = [];

  for (const file of req.files) {

    try {

      const base64Input = toBase64(file.buffer);

      /*
      ==================================================
      1️⃣ OUVRIR RECHERCHE IMAGE ALIEXPRESS
      ==================================================
      */

      const searchUrl = "https://www.aliexpress.com/p/uploadImage/search";

      const searchResponse = await axios.get(
        "http://api.scraperapi.com",
        {
          params: {
            api_key: process.env.SCRAPERAPI_KEY,
            url: searchUrl,
            render: true
          }
        }
      );

      const searchHtml = searchResponse.data;

      /*
      ==================================================
      2️⃣ EXTRAIRE JSON INTERNE (PLUS FIABLE QUE REGEX)
      ==================================================
      */

      let jsonData = null;

      const jsonMatch = searchHtml.match(/window.__INITIAL_DATA__\s*=\s*(\{.*?\});/s);

      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[1]);
        } catch {}
      }

      const productsRaw =
        jsonData?.data?.products ||
        [];

      const productsTop10 = productsRaw.slice(0, 10);

      /*
      ==================================================
      3️⃣ TRAITEMENT PARALLÈLE DES PRODUITS
      ==================================================
      */

      const productPromises = productsTop10.map(async (product) => {

        const productUrl =
          "https://www.aliexpress.com/item/" +
          product.productId +
          ".html";

        try {

          // Télécharger image produit
          const imageUrl = product.imageUrl;

          if (!imageUrl) return null;

          const imageRes = await axios.get(imageUrl, {
            responseType: "arraybuffer"
          });

          const base64Product = Buffer.from(imageRes.data).toString("base64");

          // Comparaison IA
          const similarity = await compareImages(
            base64Input,
            base64Product
          );

          return {
            title: product.title,
            price: product.price,
            url: productUrl,
            similarity: similarityPercent(similarity)
          };

        } catch {
          return null;
        }

      });

      const comparedProducts = await Promise.all(productPromises);

      /*
      ==================================================
      4️⃣ FILTRER ≥ 60%
      ==================================================
      */

      const filtered = comparedProducts
        .filter(p => p && p.similarity >= 60)
        .sort((a, b) => b.similarity - a.similarity);

      /*
      ==================================================
      5️⃣ RESULTAT FINAL
      ==================================================
      */

      results.push({
        image: file.originalname,
        totalChecked: productsTop10.length,
        matched: filtered
      });

    } catch (err) {

      results.push({
        image: file.originalname,
        matched: []
      });

    }
  }

  res.json({ results });
});

/*
====================================================
START SERVER
====================================================
*/

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
