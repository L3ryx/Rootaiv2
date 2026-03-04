require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");
const FormData = require("form-data");

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

  const payload = {
    message,
    type,
    time: new Date().toISOString()
  };

  console.log(`[${type.toUpperCase()}] ${message}`);

  if (socket) {
    socket.emit("log", payload);
  }
}

/*
====================================================
OPENAI IMAGE SIMILARITY
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
                text: "Return ONLY a similarity score between 0 and 1 for these two images."
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

    const status = err.response?.status;
    const data = err.response?.data;

    sendLog(
      socket,
      `❌ OpenAI similarity failed | Status: ${status} | Error: ${JSON.stringify(data)}`,
      "error"
    );

    return 0;
  }
}

/*
====================================================
ANALYSIS ROUTE
====================================================
*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  const socketId = req.body.socketId;
  const socket = io.sockets.sockets.get(socketId);

  const results = [];

  if (!req.files || req.files.length === 0) {

    sendLog(socket, "❌ No images uploaded", "error");

    return res.status(400).json({
      error: "No images uploaded"
    });
  }

  sendLog(socket, "📥 Images received");

  for (const file of req.files) {

    sendLog(socket, `🖼 Processing image: ${file.originalname}`);

    const base64Input = file.buffer.toString("base64");

    /*
    =====================================================
    1️⃣ CALL ALIEXPRESS IMAGE SEARCH API
    =====================================================
    */

    sendLog(socket, "🔎 Calling AliExpress image search API");

    let productsData = [];

    try {

      const form = new FormData();
      form.append("image", file.buffer, {
        filename: "image.jpg"
      });

      const searchResponse = await axios.post(
        "https://www.aliexpress.com/aer-api/search/image",
        form,
        {
          headers: {
            ...form.getHeaders(),
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
          }
        }
      );

      console.log("RAW IMAGE SEARCH RESPONSE:");
      console.log(searchResponse.data);

      productsData =
        searchResponse.data?.data?.products || [];

      sendLog(
        socket,
        `📦 ${productsData.length} products returned from image API`,
        "success"
      );

    } catch (err) {

      const status = err.response?.status;
      const data = err.response?.data;

      sendLog(
        socket,
        `❌ Image search API failed | Status: ${status} | Error: ${JSON.stringify(data)}`,
        "error"
      );

      productsData = [];
    }

    /*
    =====================================================
    2️⃣ PROCESS PRODUCTS
    =====================================================
    */

    const matchedProducts = [];

    const topProducts = productsData.slice(0, 10);

    await Promise.all(
      topProducts.map(async (product) => {

        const productId = product.productId;

        if (!productId) return;

        const productUrl =
          "https://www.aliexpress.com/item/" +
          productId +
          ".html";

        try {

          sendLog(socket, `🔍 Checking product ${productId}`);

          const productImageUrl = product.imageUrl;

          if (!productImageUrl) {

            sendLog(socket, "⚠ Product image missing", "warning");
            return;
          }

          const imgResponse = await axios.get(productImageUrl, {
            responseType: "arraybuffer"
          });

          const base64Product =
            Buffer.from(imgResponse.data).toString("base64");

          sendLog(socket, "🤖 AI comparing images");

          const similarityRaw = await calculateSimilarity(
            base64Input,
            base64Product,
            socket
          );

          const similarity = Math.round(similarityRaw * 100);

          if (similarity >= 60) {

            sendLog(socket, `✅ Match found ${similarity}%`, "success");

            matchedProducts.push({
              url: productUrl,
              similarity
            });

          } else {

            sendLog(socket, `❌ Rejected ${similarity}%`, "info");
          }

        } catch (err) {

          const status = err.response?.status;
          const data = err.response?.data;

          sendLog(
            socket,
            `❌ Product processing failed | Status: ${status} | Error: ${JSON.stringify(data)}`,
            "error"
          );

        }

      })
    );

    const sorted = matchedProducts.sort(
      (a, b) => b.similarity - a.similarity
    );

    sendLog(socket, "🏁 Image processing finished", "success");

    results.push({
      image: file.originalname,
      matches: sorted
    });
  }

  res.json({ results });
});

/*
====================================================
SOCKET.IO
====================================================
*/

io.on("connection", (socket) => {

  console.log("🟢 Client connected:", socket.id);

  socket.emit("connected", {
    socketId: socket.id
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });

});

/*
====================================================
START SERVER
====================================================
*/

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
