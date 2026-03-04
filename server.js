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

function getSimilarity(score) {
  return Math.round(score * 100);
}

/*
====================================================
IMAGE COMPARISON VIA OPENAI
====================================================
*/

async function compareImages(base64A, base64B) {

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Return similarity score between 0 and 1 for these two product images." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64A}` }
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64B}` }
            }
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

      const base64Image = toBase64(file.buffer);

      /*
      ==================================================
      1️⃣ OUVRIR RECHERCHE IMAGE OFFICIELLE ALIEXPRESS
      ==================================================
      */

      const searchUrl = "https://www.aliexpress.com/p/uploadImage/search";

      const scrape = await axios.get("http://api.scraperapi.com", {
        params: {
          api_key: process.env.SCRAPERAPI_KEY,
          url: searchUrl,
          render: true
        }
      });

      const html = scrape.data;

      /*
      ==================================================
      2️⃣ EXTRAIRE PRODUITS (TOP 10)
      ==================================================
      */

      const productMatches = [
        ...html.matchAll(/"productId":"(.*?)"/g)
      ].slice(0, 10);

      const matched = [];

      for (const match of productMatches) {

        const productId = match[1];

        const productUrl =
          "https://www.aliexpress.com/item/" + productId + ".html";

        try {

          const productPage = await axios.get(
            "http://api.scraperapi.com",
            {
              params: {
                api_key: process.env.SCRAPERAPI_KEY,
                url: productUrl,
                render: true
              }
            }
          );

          const productHtml = productPage.data;

          const imgMatch = productHtml.match(/"imageUrl":"(.*?)"/);

          if (!imgMatch) continue;

          const productImageUrl =
            imgMatch[1].replace(/\\\//g, "/");

          const productImage = await axios.get(productImageUrl, {
            responseType: "arraybuffer"
          });

          const base64Product = Buffer.from(
            productImage.data
          ).toString("base64");

          const similarity = await compareImages(
            base64Image,
            base64Product
          );

          if (similarity >= 0.6) {

            matched.push({
              productUrl,
              similarity: getSimilarity(similarity)
            });
          }

        } catch (err) {
          console.log("Product check failed:", err.message);
        }
      }

      results.push({
        image: file.originalname,
        products: matched
      });

    } catch (err) {

      results.push({
        image: file.originalname,
        products: []
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
  console.log("Server running");
});
