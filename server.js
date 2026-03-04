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

// Convert image buffer to base64
function toBase64(buffer) {
  return buffer.toString("base64");
}

// Simple text similarity score
function similarityScore(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(" ");
  const words2 = text2.toLowerCase().split(" ");

  const matches = words1.filter(word => words2.includes(word));

  return matches.length / Math.max(words1.length, 1);
}

/*
====================================================
IMAGE ANALYSIS ROUTE
====================================================
*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  const finalResults = [];

  for (const file of req.files) {

    try {

      const base64Image = toBase64(file.buffer);

      /*
      ====================================================
      1️⃣ OPENAI VISION → Describe Image
      ====================================================
      */

      let imageDescription = "";

      try {
        const visionResponse = await axios.post(
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
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
              "Content-Type": "application/json"
            }
          }
        );

        imageDescription =
          visionResponse.data.choices[0].message.content;

      } catch (err) {
        console.log("Vision API failed:", err.message);
      }

      /*
      ====================================================
      2️⃣ ZENSERP → Search Products via Description
      ====================================================
      */

      let searchResults = [];

      try {
        const zenserpResponse = await axios.get(
          "https://app.zenserp.com/api/v2/search",
          {
            params: {
              apikey: process.env.ZENSERP_API_KEY,
              q: imageDescription,
              tbm: "shop"
            }
          }
        );

        searchResults = zenserpResponse.data.organic || [];

      } catch (err) {
        console.log("Zenserp failed:", err.message);
      }

      /*
      ====================================================
      3️⃣ FILTER ONLY ALIEXPRESS LINKS
      ====================================================
      */

      const aliexpressLinks = searchResults
        .map(item => item.link)
        .filter(link => link && link.includes("aliexpress.com"));

      /*
      ====================================================
      4️⃣ SCRAPERAPI → Scrape Product Pages
      ====================================================
      */

      const products = [];

      for (const link of aliexpressLinks) {

        try {

          const scrape = await axios.get(
            "http://api.scraperapi.com",
            {
              params: {
                api_key: process.env.SCRAPERAPI_KEY,
                url: link,
                render: true
              }
            }
          );

          const html = scrape.data;

          const titleMatch = html.match(/<title>(.*?)<\/title>/);
          const priceMatch = html.match(/"price":"(.*?)"/);

          const title = titleMatch ? titleMatch[1] : "Unknown";
          const price = priceMatch ? priceMatch[1] : "Unknown";

          const score = similarityScore(imageDescription, title);

          /*
          ====================================================
          5️⃣ FILTER BY SIMILARITY SCORE
          ====================================================
          */

          if (score > 0.3) {
            products.push({
              url: link,
              title,
              price,
              similarityScore: score
            });
          }

        } catch (err) {
          console.log("Scraping failed:", link);
        }
      }

      /*
      ====================================================
      FINAL RESULT
      ====================================================
      */

      finalResults.push({
        imageName: file.originalname,
        description: imageDescription,
        products
      });

    } catch (err) {

      finalResults.push({
        imageName: file.originalname,
        error: "Pipeline failed"
      });

    }
  }

  res.json({ results: finalResults });
});

/*
====================================================
START SERVER
====================================================
*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
