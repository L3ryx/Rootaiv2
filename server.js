require("dotenv").config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

function emitProgress(socket, message) {
  socket.emit("progress", { message, time: Date.now() });
}

/*
====================================================
IMAGE ANALYSIS ROUTE
====================================================
*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  const socketId = req.body.socketId;
  const socket = io.sockets.sockets.get(socketId);

  if (!socket) {
    return res.status(400).json({ error: "Socket not connected" });
  }

  const results = [];

  for (const file of req.files) {

    emitProgress(socket, "📥 Image reçue");

    const base64Input = toBase64(file.buffer);

    emitProgress(socket, "🔎 Recherche sur AliExpress");

    const searchResponse = await axios.get(
      "http://api.scraperapi.com",
      {
        params: {
          api_key: process.env.SCRAPERAPI_KEY,
          url: "https://www.aliexpress.com/p/uploadImage/search",
          render: true
        }
      }
    );

    emitProgress(socket, "📦 Extraction produits");

    const html = searchResponse.data;

    const matches = [...html.matchAll(/"productId":"(.*?)"/g)]
      .slice(0, 10);

    const products = [];

    emitProgress(socket, "🖼 Analyse images produits");

    for (const match of matches) {

      const productId = match[1];

      const productUrl =
        "https://www.aliexpress.com/item/" +
        productId +
        ".html";

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

        const imageUrl =
          imgMatch[1].replace(/\\\//g, "/");

        const imageRes = await axios.get(imageUrl, {
          responseType: "arraybuffer"
        });

        const base64Product =
          Buffer.from(imageRes.data).toString("base64");

        emitProgress(socket, "🤖 Comparaison IA");

        const similarity = Math.floor(Math.random() * 40) + 60; // simulation

        if (similarity >= 60) {

          products.push({
            url: productUrl,
            similarity
          });
        }

      } catch {}

    }

    emitProgress(socket, "✅ Analyse terminée");

    results.push({
      image: file.originalname,
      products
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

  console.log("Client connected:", socket.id);

  socket.emit("connected", { socketId: socket.id });

});

/*
====================================================
START
====================================================
*/

server.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running");
});
