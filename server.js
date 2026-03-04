require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const upload = multer({
  storage: multer.memoryStorage()
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

/*
====================================================
LOG SYSTEM
====================================================
*/

function sendLog(socket, message, type = "info") {

  console.log(`[${type}] ${message}`);

  if (socket) {
    socket.emit("log", {
      message,
      type,
      time: new Date().toISOString()
    });
  }
}

/*
====================================================
SIMILARITY
====================================================
*/

async function calculateSimilarity(base64A, base64B, socket) {

  try {

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Return ONLY a similarity score between 0 and 1."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64A}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64B}`
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

    const text = response.data.choices[0].message.content;
    const match = text.match(/0\.\d+|1(\.0+)?/);

    return match ? parseFloat(match[0]) : 0;

  } catch (err) {

    sendLog(socket, `❌ Similarity failed`, "error");

    return 0;
  }
}

/*
====================================================
ANALYZE ROUTE — SCRAPER METHOD
====================================================
*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  const socketId = req.body.socketId;
  const socket = io.sockets.sockets.get(socketId);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No images uploaded" });
  }

  const results = [];

  for (const file of req.files) {

    sendLog(socket, `🖼 Processing ${file.originalname}`);

    const base64Input = file.buffer.toString("base64");

    /*
    =====================================================
    STEP 1 — SEARCH IMAGE VIA SCRAPER (NOT API)
    =====================================================
    */

    sendLog(socket, "🔎 Searching via page scraping");

    let html = "";

    try {

      const searchUrl =
        "https://www.aliexpress.com/wholesale?SearchText=product";

      const response = await axios.get(
        "http://api.scraperapi.com",
        {
          params: {
            api_key: process.env.SCRAPERAPI_KEY,
            url: searchUrl,
            render: true
          }
        }
      );

      html = response.data;

    } catch (err) {

      sendLog(socket, "❌ Scraper failed", "error");

      results.push({
        image: file.originalname,
        matches: []
      });

      continue;
    }

    /*
    =====================================================
    STEP 2 — EXTRACT PRODUCTS FROM APOLLO STATE
    =====================================================
    */

    sendLog(socket, "📦 Extracting products from page");

    const jsonMatch =
      html.match(/window\.__APOLLO_STATE__\s*=\s*(\{.*?\});/s);

    let products = [];

    if (jsonMatch) {

      try {

        const state = JSON.parse(jsonMatch[1]);

        const productKeys = Object.keys(state)
          .filter(k => k.includes("Product"));

        products = productKeys.map(k => {

          const p = state[k];

          return {
            productId: p.productId,
            imageUrl: p.imageUrl
          };

        }).filter(p => p.productId);

      } catch (err) {

        sendLog(socket, "❌ Failed parsing Apollo state", "error");
      }
    }

    sendLog(socket, `📦 ${products.length} products extracted`);

    /*
    =====================================================
    STEP 3 — COMPARE PRODUCTS
    =====================================================
    */

    const matched = [];

    const topProducts = products.slice(0, 10);

    for (const product of topProducts) {

      const productUrl =
        "https://www.aliexpress.com/item/" +
        product.productId +
        ".html";

      sendLog(socket, `🔍 Checking ${product.productId}`);

      try {

        if (!product.imageUrl) continue;

        const img = await axios.get(product.imageUrl, {
          responseType: "arraybuffer"
        });

        const base64Product =
          Buffer.from(img.data).toString("base64");

        const similarity = Math.round(
          (await calculateSimilarity(
            base64Input,
            base64Product,
            socket
          )) * 100
        );

        if (similarity >= 60) {

          sendLog(socket, `✅ Match ${similarity}%`, "success");

          matched.push({
            url: productUrl,
            similarity
          });
        }

      } catch {

        sendLog(socket, "❌ Product comparison failed", "error");

      }
    }

    results.push({
      image: file.originalname,
      matches: matched.sort(
        (a, b) => b.similarity - a.similarity
      )
    });

  }

  res.json({ results });
});

/*
====================================================
SOCKET
====================================================
*/

io.on("connection", (socket) => {

  console.log("🟢 Client connected");

  socket.emit("connected", {
    socketId: socket.id
  });

});

/*
====================================================
START
====================================================
*/

server.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
