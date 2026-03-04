// ===============================
// ALI SEARCH AI SERVER
// PRO VERSION
// ===============================

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const CryptoJS = require("crypto-js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const CONFIG_PATH = "./config.json";
const uploadDir = path.join(__dirname, "uploads");

const SECRET_ENCRYPT_KEY = "SUPER_SECRET_KEY_CHANGE_IT";

const ADMIN_HASH_PASSWORD =
  bcrypt.hashSync("admin123", 10); // 🔐 CHANGE PASSWORD HERE

/* ===============================
   CONFIG SYSTEM WITH ENCRYPTION
================================*/

function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const encrypted = fs.readFileSync(CONFIG_PATH, "utf8");
  if (!encrypted) return {};

  const bytes = CryptoJS.AES.decrypt(
    encrypted,
    SECRET_ENCRYPT_KEY
  );

  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  return JSON.parse(decrypted || "{}");
}

function saveConfig(config) {

  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(config),
    SECRET_ENCRYPT_KEY
  ).toString();

  fs.writeFileSync(CONFIG_PATH, encrypted);
}

/* ===============================
   FILE STORAGE
================================*/

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + file.originalname);
    }
  })
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
app.use(express.static("public"));

/* ===============================
   LOGIN ROUTE
================================*/

app.post("/admin/login", async (req, res) => {

  const { password } = req.body;

  const match = await bcrypt.compare(
    password,
    ADMIN_HASH_PASSWORD
  );

  if (!match) {
    return res.status(401).json({ error: "Wrong password" });
  }

  res.json({ success: true });
});

/* ===============================
   ADMIN CONFIG ROUTES
================================*/

app.get("/api/config", (req, res) => {

  const config = getConfig();
  res.json(config);

});

app.post("/api/config", (req, res) => {

  saveConfig(req.body);
  res.json({ success: true });

});

/* ===============================
   ANALYZE ROUTE
================================*/

app.post("/analyze", upload.array("images"), async (req, res) => {

  const config = getConfig();
  const results = [];

  for (const file of req.files) {

    const publicUrl =
      `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;

    let serpResults = [];

    try {

      const response = await axios.get(
        "https://serpapi.com/search",
        {
          params: {
            engine: "google_reverse_image",
            image_url: publicUrl,
            api_key: config.SERPAPI_KEY
          }
        }
      );

      serpResults = response.data?.image_results || [];

    } catch (err) {
      serpResults = [];
    }

    const matches = serpResults
      .filter(r => r.link?.includes("aliexpress.com"))
      .slice(0, 5)
      .map(r => ({
        url: r.link,
        similarity: 70
      }));

    results.push({
      image: file.filename,
      matches
    });
  }

  res.json({ results });

});

/* ===============================
   SOCKET
================================*/

io.on("connection", (socket) => {
  socket.emit("connected", { socketId: socket.id });
});

/* ===============================
   START
================================*/

server.listen(3000, () => {
  console.log("🚀 Ali Search AI Running");
});
