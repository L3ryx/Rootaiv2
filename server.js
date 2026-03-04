// ======================================================
// ROOT AI - USER PROVIDED API KEYS VERSION
// No authentication
// Keys are sent from frontend
// ======================================================

const express = require("express");
const http = require("http");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({
  storage: multer.memoryStorage()
});

/* ======================================================
   ANALYSIS PIPELINE
====================================================== */

app.post("/analyze", upload.single("image"), async (req, res) => {

  try {

    const { imgbb, openai, serpapi } = req.body;

    if (!openai)
      return res.json({ error: "OpenAI key missing" });

    if (!req.file)
      return res.json({ error: "No image uploaded" });

    // ==================================================
    // 1️⃣ Upload Image To ImgBB
    // ==================================================

    let imageUrl = null;

    if (imgbb) {

      const form = new FormData();
      form.append("image", req.file.buffer.toString("base64"));

      const imgRes = await axios.post(
        `https://api.imgbb.com/1/upload?key=${imgbb}`,
        form,
        { headers: form.getHeaders() }
      );

      imageUrl = imgRes.data.data.url;

    }

    // ==================================================
    // 2️⃣ OpenAI Vision Analysis
    // ==================================================

    const vision = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse cette image et décris le produit." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${openai}`,
          "Content-Type": "application/json"
        }
      }
    );

    const description =
      vision.data.choices[0].message.content;

    // ==================================================
    // 3️⃣ SerpAPI Product Search
    // ==================================================

    let products = [];

    if (serpapi) {

      const serp = await axios.get("https://serpapi.com/search", {
        params: {
          engine: "google_shopping",
          q: description,
          api_key: serpapi
        }
      });

      products = serp.data.shopping_results || [];
    }

    // ==================================================
    // 4️⃣ Filter AliExpress
    // ==================================================

    const aliProducts = products.filter(p =>
      p.link && p.link.includes("aliexpress")
    );

    res.json({
      image: imageUrl,
      description,
      aliProducts
    });

  } catch (err) {

    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Pipeline failed" });

  }

});

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
