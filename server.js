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
LOG SYSTEM (WITH ERROR DETAIL)
====================================================
*/

function sendLog(socket, message, type = "info", errorDetails = null) {

  const payload = {
    message,
    type,
    time: new Date().toISOString(),
    errorDetails
  };

  console.log(`[${type.toUpperCase()}] ${message}`);

  if (errorDetails) {
    console.log("🔴 ERROR DETAILS:");
    console.log(errorDetails);
  }

  if (socket) {
    socket.emit("log", payload);
  }
}

/*
====================================================
SIMILARITY FUNCTION
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

    sendLog(
      socket,
      "❌ Similarity API failed",
      "error",
      {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
        url: err.config?.url
      }
    );

    return 0;
  }
}

/*
====================================================
ANALYZE ROUTE
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
    SCRAPER REQUEST
    =====================================================
    */

    sendLog(socket, "🔎 Calling ScraperAPI");

    let html = "";

    try {

      const response = await axios.get(
        "http://api.scraperapi.com",
        {
          params: {
            api_key: process.env.SCRAPERAPI_KEY,
            url: "https://www.aliexpress.com/wholesale?SearchText=test",
            render: true
          }
        }
      );

      html = response.data;

    } catch (err) {

      sendLog(
        socket,
        "❌ Scraper request failed",
        "error",
        {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
          url: err.config?.url
        }
      );

      results.push({
        image: file.originalname,
        matches: []
      });

      continue;
    }

    /*
    =====================================================
    EXTRACT APOLLO STATE
    =====================================================
    */

    sendLog(socket, "📦 Extracting products from HTML");

    const match = html.match(
      /window\.__APOLLO_STATE__\s*=\s*(\{.*?\});/s
    );

    let products = [];

    if (!match) {

      sendLog(
        socket,
        "⚠ Apollo state not found in page",
        "warning"
      );

    } else {

      try {

        const state = JSON.parse(match[1]);

        const keys = Object.keys(state).filter(k =>
          k.includes("Product")
        );

        products = keys.map(k => ({
          productId: state[k].productId,
          imageUrl: state[k].imageUrl
        })).filter(p => p.productId);

      } catch (err) {

        sendLog(
          socket,
          "❌ Failed parsing Apollo JSON",
          "error",
          {
            message: err.message
          }
        );

      }
    }

    sendLog(socket, `📦 ${products.length} products extracted`);

    /*
    =====================================================
    COMPARE PRODUCTS
    =====================================================
    */

    const matched = [];

    for (const product of products.slice(0, 10)) {

      sendLog(socket, `🔍 Checking product ${product.productId}`);

      if (!product.imageUrl) {

        sendLog(socket, "⚠ Product missing imageUrl", "warning");
        continue;
      }

      try {

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
            url:
              "https://www.aliexpress.com/item/" +
              product.productId +
              ".html",
            similarity
          });

        } else {

          sendLog(socket, `❌ Rejected ${similarity}%`, "info");
        }

      } catch (err) {

        sendLog(
          socket,
          "❌ Product image download failed",
          "error",
          {
            status: err.response?.status,
            message: err.message,
            url: product.imageUrl
          }
        );
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
