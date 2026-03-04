// ======================================================
// ALI SEARCH AI
// SERVER VERSION PRO FINAL
// ======================================================

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

const PORT = 3000;

const CONFIG_PATH = "./config.json";
const LOG_PATH = "./logs.json";

const SECRET_KEY = "CHANGE_THIS_SECRET_KEY";

const ADMIN_PASSWORD = "admin123"; // 🔐 CHANGE THIS

// ======================================================
// CONFIG SYSTEM (ENCRYPTED)
// ======================================================

function getConfig() {

  if (!fs.existsSync(CONFIG_PATH)) return {};

  const encrypted = fs.readFileSync(CONFIG_PATH, "utf8");
  if (!encrypted) return {};

  try {

    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    return JSON.parse(decrypted || "{}");

  } catch (err) {
    return {};
  }
}

function saveConfig(config) {

  const encrypted = CryptoJS.AES.encrypt(
    JSON.stringify(config),
    SECRET_KEY
  ).toString();

  fs.writeFileSync(CONFIG_PATH, encrypted);
}

// ======================================================
// LOG SYSTEM
// ======================================================

function saveLog(message) {

  let logs = [];

  if (fs.existsSync(LOG_PATH)) {
    logs = JSON.parse(fs.readFileSync(LOG_PATH));
  }

  logs.push({
    message,
    time: new Date()
  });

  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));
}

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, "uploads");

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

app.use("/uploads", express.static(uploadDir));
app.use(express.static("public"));

// ======================================================
// ADMIN LOGIN
// ======================================================

app.post("/admin/login", async (req, res) => {

  const { password } = req.body;

  const match = await bcrypt.compare(
    password,
    bcrypt.hashSync(ADMIN_PASSWORD, 10)
  );

  if (!match) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({ success: true });

});

// ======================================================
// CONFIG ROUTES (PROTECTED)
// ======================================================

app.get("/api/config", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  res.json(getConfig());

});

app.post("/api/config", (req, res) => {

  const { password, config } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  saveConfig(config);

  res.json({ success: true });

});

// ======================================================
// LOG ROUTE
// ======================================================

app.get("/api/logs", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!fs.existsSync(LOG_PATH)) {
    return res.json([]);
  }

  const logs = JSON.parse(fs.readFileSync(LOG_PATH));

  res.json(logs);

});

// ======================================================
// ANALYZE ROUTE
// ======================================================

app.post("/analyze", upload.array("images"), async (req, res) => {

  const config = getConfig();

  const results = [];

  for (const file of req.files) {

    const publicUrl =
      `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;

    saveLog("Analyzing image: " + file.filename);

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

      saveLog("SerpAPI returned " + serpResults.length + " results");

    } catch (err) {

      saveLog("SerpAPI error: " + err.message);

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
      publicUrl,
      matches
    });

  }

  res.json({ results });

});

// ======================================================
// SOCKET
// ======================================================

io.on("connection", (socket) => {
  socket.emit("connected", { socketId: socket.id });
  console.log("🟢 Client connected");
});

// ======================================================
// START SERVER
// ======================================================

server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
