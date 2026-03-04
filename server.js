// ======================================================
// ALI SEARCH AI - SERVER CLEAN FINAL
// ======================================================

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const CryptoJS = require("crypto-js");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const PORT = 3000;

const SECRET_KEY = "CHANGE_THIS_SECRET";
const ADMIN_PASSWORD = "admin123";

const CONFIG_PATH = "./config.json";
const USERS_PATH = "./users.json";
const SESSIONS_PATH = "./sessions.json";
const LOG_PATH = "./logs.json";

// ======================================================
// UTILS
// ======================================================

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ======================================================
// CONFIG ENCRYPTED
// ======================================================

function getConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const encrypted = fs.readFileSync(CONFIG_PATH, "utf8");
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

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

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

// ======================================================
// REGISTER (ROLE SUPPORTED)
// ======================================================

app.post("/api/register", async (req, res) => {

  const { username, password, role } = req.body;

  const users = readJSON(USERS_PATH, []);

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "User exists" });
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    username,
    password: hash,
    role: role || "user",
    createdAt: new Date()
  });

  writeJSON(USERS_PATH, users);

  res.json({ success: true });
});

// ======================================================
// LOGIN (USER + ADMIN)
// ======================================================

app.post("/api/login", async (req, res) => {

  const { username, password } = req.body;

  const users = readJSON(USERS_PATH, []);
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: "Not found" });

  const match = await bcrypt.compare(password, user.password);

  if (!match) return res.status(401).json({ error: "Wrong password" });

  const token = crypto.randomUUID();

  const sessions = readJSON(SESSIONS_PATH, []);

  sessions.push({
    token,
    username,
    role: user.role || "user"
  });

  writeJSON(SESSIONS_PATH, sessions);

  res.json({
    token,
    role: user.role || "user"
  });
});

// ======================================================
// LOGOUT
// ======================================================

app.post("/api/logout", (req, res) => {

  const { token } = req.body;

  let sessions = readJSON(SESSIONS_PATH, []);
  sessions = sessions.filter(s => s.token !== token);

  writeJSON(SESSIONS_PATH, sessions);

  res.json({ success: true });
});

// ======================================================
// ADMIN LOGIN
// ======================================================

app.post("/admin/login", async (req, res) => {

  const { password } = req.body;

  const match = await bcrypt.compare(
    password,
    bcrypt.hashSync(ADMIN_PASSWORD, 10)
  );

  if (!match) return res.status(401).json({ error: "Unauthorized" });

  res.json({ success: true });
});

// ======================================================
// ADMIN ROUTES
// ======================================================

app.get("/api/users", (req, res) => {

  const password = req.query.password;

  if (password !== ADMIN_PASSWORD)
    return res.status(403).json({ error: "Unauthorized" });

  res.json(readJSON(USERS_PATH, []));
});

// ======================================================
// ANALYZE IMAGE
// ======================================================

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

    } catch {}

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

// ======================================================
// START SERVER
// ======================================================

server.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
