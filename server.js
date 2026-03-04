// ======================================================
// ALI SEARCH AI
// FULL CLEAN PRO SERVER
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
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

const SECRET_KEY = "CHANGE_THIS_SECRET";
const ADMIN_PASSWORD = "admin123";

/* =====================================================
   FILE PATHS
===================================================== */

const CONFIG_PATH = "./config.json";
const USERS_PATH = "./users.json";
const SESSIONS_PATH = "./sessions.json";
const LOG_PATH = "./logs.json";

/* =====================================================
   UTIL FUNCTIONS
===================================================== */

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

/* =====================================================
   ENCRYPTED CONFIG
===================================================== */

function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};

  const encrypted = fs.readFileSync(CONFIG_PATH, "utf8");
  if (!encrypted) return {};

  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8) || "{}");
  } catch {
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

/* =====================================================
   USERS SYSTEM
===================================================== */

function getUsers() {
  return readJSON(USERS_PATH, []);
}

function saveUsers(users) {
  writeJSON(USERS_PATH, users);
}

/* =====================================================
   SESSIONS
===================================================== */

function getSessions() {
  return readJSON(SESSIONS_PATH, []);
}

function saveSessions(sessions) {
  writeJSON(SESSIONS_PATH, sessions);
}

/* =====================================================
   LOG SYSTEM
===================================================== */

function saveLog(message) {

  const logs = readJSON(LOG_PATH, []);

  logs.push({
    message,
    time: new Date()
  });

  writeJSON(LOG_PATH, logs);
}

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname)
  })
});

app.use("/uploads", express.static(uploadDir));
app.use(express.static("public"));
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

/* =====================================================
   REGISTER
===================================================== */

app.post("/api/register", async (req, res) => {

  const { username, password } = req.body;
  const users = getUsers();

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "User exists" });
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    username,
    password: hash,
    createdAt: new Date()
  });

  saveUsers(users);

  res.json({ success: true });

});

/* =====================================================
   LOGIN
===================================================== */

app.post("/api/login", async (req, res) => {

  const { username, password } = req.body;

  const users = getUsers();
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.status(401).json({ error: "Wrong password" });

  const token = crypto.randomUUID();

  const sessions = getSessions();
  sessions.push({
    token,
    username,
    createdAt: new Date()
  });

  saveSessions(sessions);

  res.json({ token });

});

/* =====================================================
   LOGOUT
===================================================== */

app.post("/api/logout", (req, res) => {

  const { token } = req.body;

  let sessions = getSessions();
  sessions = sessions.filter(s => s.token !== token);

  saveSessions(sessions);

  res.json({ success: true });

});

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post("/admin/login", async (req, res) => {

  const { password } = req.body;

  const match = await bcrypt.compare(
    password,
    bcrypt.hashSync(ADMIN_PASSWORD, 10)
  );

  if (!match) return res.status(401).json({ error: "Unauthorized" });

  res.json({ success: true });

});

/* =====================================================
   CONFIG ROUTES (ADMIN ONLY)
===================================================== */

app.get("/api/config", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  res.json(getConfig());

});

app.post("/api/config", (req, res) => {

  const { password, config } = req.body;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  saveConfig(config);
  res.json({ success: true });

});

/* =====================================================
   LOGS
===================================================== */

app.get("/api/logs", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  res.json(readJSON(LOG_PATH, []));

});

app.post("/api/logs/clear", (req, res) => {

  const { password } = req.body;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  writeJSON(LOG_PATH, []);
  res.json({ success: true });

});

/* =====================================================
   LIST USERS (ADMIN DASHBOARD)
===================================================== */

app.get("/api/users", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  res.json(getUsers());

});

/* =====================================================
   ANALYZE IMAGE
===================================================== */

app.post("/analyze", upload.array("images"), async (req, res) => {

  const config = getConfig();
  const results = [];

  for (const file of req.files) {

    const publicUrl =
      `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;

    saveLog("Analyzing " + file.filename);

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

      saveLog("SerpAPI error: " + err.message);

    }

    const matches = serpResults
      .filter(r => r.link?.includes("aliexpress.com"))
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

/* =====================================================
   START SERVER
===================================================== */

server.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
