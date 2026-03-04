// ======================================================
// STABLE PIPELINE VERSION
// Upload → SerpAPI → Filter → OpenAI Compare → Logs
// ======================================================

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({
  storage: multer.memoryStorage()
});

/* ======================================================
   PIPELINE
====================================================== */

app.post("/analyze", upload.single("image"), async (req, res) => {

  try {

    const { serpapi, openai } = req.body;

    if (!req.file)
      return res.json({ error: "No image uploaded" });

    if (!serpapi || !openai)
      return res.json({ error: "Missing API keys" });

    // ==================================================
    // 1️⃣ Convert Image To Base64
    // ==================================================

    const base64Image = req.file.buffer.toString("base64");

    // ==================================================
    // 2️⃣ SerpAPI Text Search (Stable)
    // ==================================================

    const serpResponse = await axios.get("https://serpapi.com/search", {
      params: {
        engine: "google_shopping",
        q: "product",
        api_key: serpapi
      }
    });

    const products = serpResponse.data.shopping_results || [];

    // ==================================================
    // 3️⃣ Filter AliExpress
    // ==================================================

    const aliProducts = products.filter(p =>
      p.link && p.link.includes("aliexpress")
    );

    // ==================================================
    // 4️⃣ OpenAI Product Comparison
    // ==================================================

    let comparison = null;

    if (aliProducts.length > 0) {

      const aiResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: `
Compare these AliExpress products:

${JSON.stringify(aliProducts.slice(0,5), null, 2)}

Return:
- Best product
- Why
- Price comparison
`
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

      comparison = aiResponse.data.choices[0].message.content;
    }

    // ==================================================
    // 5️⃣ Logs
    // ==================================================

    const log = {
      time: new Date(),
      totalAliProducts: aliProducts.length
    };

    fs.appendFileSync("logs.json", JSON.stringify(log) + "\n");

    // ==================================================
    // RESPONSE
    // ==================================================

    res.json({
      products: aliProducts,
      comparison
    });

  } catch (err) {

    console.error(err.response?.data || err.message);

    res.status(500).json({
      error: "Pipeline failed",
      debug: err.message
    });

  }

});

/* ======================================================
   LIVE LOGS
====================================================== */

app.get("/logs", (req, res) => {

  if (!fs.existsSync("logs.json"))
    return res.json([]);

  const logs = fs.readFileSync("logs.json", "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));

  res.json(logs);
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
