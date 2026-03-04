// ======================================================
// UPLOAD → SERPAPI → FILTER → OPENAI COMPARE → LOGS
// ======================================================

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
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

    const { serpapi, openai } = req.body;

    if (!req.file)
      return res.json({ error: "No image uploaded" });

    if (!serpapi || !openai)
      return res.json({ error: "Missing API keys" });

    // ==================================================
    // 1️⃣ Send Image To SerpAPI (Reverse Search)
    // ==================================================

    const imageBase64 = req.file.buffer.toString("base64");

    const serpResponse = await axios.post(
      "https://serpapi.com/search",
      null,
      {
        params: {
          engine: "google_lens",
          image_url: `data:image/jpeg;base64,${imageBase64}`,
          api_key: serpapi
        }
      }
    );

    const results = serpResponse.data.visual_matches || [];

    // ==================================================
    // 2️⃣ Filter AliExpress Products
    // ==================================================

    const aliProducts = results.filter(p =>
      p.link && p.link.includes("aliexpress")
    );

    // ==================================================
    // 3️⃣ OpenAI Product Comparison
    // ==================================================

    let comparison = null;

    if (aliProducts.length > 0) {

      const ai = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: `
Compare these AliExpress products:

${JSON.stringify(aliProducts.slice(0, 5), null, 2)}

Return:
- Best product
- Price comparison
- Recommendation
`
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${openai}`,
            "Content-Type": "application/json"
          }
        }
      );

      comparison = ai.data.choices[0].message.content;
    }

    // ==================================================
    // 4️⃣ Logs Live
    // ==================================================

    const log = {
      time: new Date(),
      totalProducts: aliProducts.length
    };

    fs.appendFileSync("logs.json", JSON.stringify(log) + "\n");

    // ==================================================
    // 5️⃣ RESPONSE
    // ==================================================

    res.json({
      products: aliProducts,
      comparison
    });

  } catch (err) {

    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Pipeline failed" });

  }

});

/* ======================================================
   LOGS LIVE
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
