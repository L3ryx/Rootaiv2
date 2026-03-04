require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const sharp = require("sharp");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static("public"));

/*
==================================================
UTILITY : IMAGE TO BASE64
==================================================
*/
function imageToBase64(buffer) {
  return buffer.toString("base64");
}

/*
==================================================
IA IMAGE SIMILARITY (OPENAI VISION)
==================================================
*/
async function getImageDescription(base64Image) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this product image in detail." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
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

  return response.data.choices[0].message.content;
}

/*
==================================================
PIPELINE ROUTE
==================================================
*/
app.post("/analyze", upload.array("images"), async (req, res) => {
  const finalResults = [];

  for (const file of req.files) {
    try {
      const base64Image = imageToBase64(file.buffer);

      /*
      ==========================================
      1️⃣ ZENSERP IMAGE SEARCH
      ==========================================
      */

      const zenserp = await axios.get(
        "https://app.zenserp.com/api/v2/search",
        {
          params: {
            apikey: process.env.ZENSERP_API_KEY,
            tbm: "isch",
            image_url: `data:image/jpeg;base64,${base64Image}`
          }
        }
      );

      const links = zenserp.data.organic || [];

      const aliexpressLinks = links
        .map(r => r.link)
        .filter(l => l && l.includes("aliexpress.com"));

      /*
      ==========================================
      2️⃣ SCRAPERAPI SCRAPE PRODUCTS
      ==========================================
      */

      const scrapedProducts = [];

      for (const link of aliexpressLinks) {
        try {
          const scrape = await axios.get("http://api.scraperapi.com", {
            params: {
              api_key: process.env.SCRAPERAPI_KEY,
              url: link,
              render: true
            }
          });

          const html = scrape.data;

          const titleMatch = html.match(/<title>(.*?)<\/title>/);
          const priceMatch = html.match(/"productPrice":"(.*?)"/);

          scrapedProducts.push({
            url: link,
            title: titleMatch ? titleMatch[1] : "Unknown",
            price: priceMatch ? priceMatch[1] : "Unknown"
          });
        } catch (err) {
          console.log("Scraping failed for:", link);
        }
      }

      /*
      ==========================================
      3️⃣ IA IMAGE SIMILARITY
      ==========================================
      */

      const description = await getImageDescription(base64Image);

      /*
      ==========================================
      4️⃣ FILTRAGE INTELLIGENT
      ==========================================
      */

      const filteredProducts = scrapedProducts.filter(product => {
        const score = similarityScore(description, product.title);

        return score > 0.5; // seuil de filtrage
      });

      /*
      ==========================================
      5️⃣ RESULT
      ==========================================
      */

      finalResults.push({
        image: file.originalname,
        description,
        products: filteredProducts
      });

    } catch (err) {
      finalResults.push({
        image: file.originalname,
        error: "Pipeline failed"
      });
    }
  }

  res.json({ results: finalResults });
});

/*
==================================================
SIMPLE TEXT SIMILARITY SCORE
==================================================
*/
function similarityScore(text1, text2) {
  const words1 = text1.toLowerCase().split(" ");
  const words2 = text2.toLowerCase().split(" ");

  const intersection = words1.filter(word => words2.includes(word));
  return intersection.length / Math.max(words1.length, 1);
}

/*
==================================================
START SERVER
==================================================
*/

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
