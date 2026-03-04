// ======================================================
// ALI SEARCH AI - ULTRA SECURE VERSION
// ======================================================

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const PORT = 3000;

const ADMIN_USERNAME = "darkoff";
const ADMIN_PASSWORD_PLAIN = "Bretigny91";

const USERS_PATH = "./users.json";
const SESSIONS_PATH = "./sessions.json";

const SESSION_DURATION = 1000 * 60 * 60; // ⏳ 1 heure

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
// AUTO CREATE ADMIN (IMMUTABLE)
// ======================================================

async function createDefaultAdmin() {

  const users = readJSON(USERS_PATH, []);

  const exists = users.find(u => u.username === ADMIN_USERNAME);

  if (exists) return;

  const hash = await bcrypt.hash(ADMIN_PASSWORD_PLAIN, 10);

  users.push({
    username: ADMIN_USERNAME,
    password: hash,
    role: "admin",
    immutable: true,
    createdAt: new Date()
  });

  writeJSON(USERS_PATH, users);

  console.log("🚀 Default admin created");

}

// ======================================================
// SESSION CLEANER
// ======================================================

function cleanExpiredSessions() {

  const sessions = readJSON(SESSIONS_PATH, []);

  const now = Date.now();

  const active = sessions.filter(session => {

    return now - session.createdAt < SESSION_DURATION;

  });

  writeJSON(SESSIONS_PATH, active);

}

// Run cleanup every 10 minutes
setInterval(cleanExpiredSessions, 600000);

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

function authMiddleware(req, res, next) {

  const token = req.headers.authorization;

  if (!token)
    return res.status(401).json({ error: "No token" });

  cleanExpiredSessions();

  const sessions = readJSON(SESSIONS_PATH, []);

  const session = sessions.find(s => s.token === token);

  if (!session)
    return res.status(401).json({ error: "Invalid session" });

  req.user = session;
  next();
}

function adminMiddleware(req, res, next) {

  const token = req.headers.authorization;

  cleanExpiredSessions();

  const sessions = readJSON(SESSIONS_PATH, []);

  const session = sessions.find(
    s => s.token === token && s.role === "admin"
  );

  if (!session)
    return res.status(403).json({ error: "Admin only" });

  next();
}

// ======================================================
// EXPRESS CONFIG
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
// REGISTER (FORCE ROLE USER)
// ======================================================

app.post("/api/register", async (req, res) => {

  const { username, password } = req.body;

  const users = readJSON(USERS_PATH, []);

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "User exists" });
  }

  const hash = await bcrypt.hash(password, 10);

  users.push({
    username,
    password: hash,
    role: "user",
    immutable: false,
    createdAt: new Date()
  });

  writeJSON(USERS_PATH, users);

  res.json({ success: true });
});

// ======================================================
// LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {

  const { username, password } = req.body;

  const users = readJSON(USERS_PATH, []);
  const user = users.find(u => u.username === username);

  if (!user)
    return res.status(404).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);

  if (!match)
    return res.status(401).json({ error: "Wrong password" });

  const token = crypto.randomUUID();

  const sessions = readJSON(SESSIONS_PATH, []);

  sessions.push({
    token,
    username,
    role: user.role,
    createdAt: Date.now()
  });

  writeJSON(SESSIONS_PATH, sessions);

  res.json({ token, role: user.role });
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
// ADMIN PROTECTED ROUTE
// ======================================================

app.get("/api/admin/users", adminMiddleware, (req, res) => {

  const users = readJSON(USERS_PATH, []);

  const safe = users.map(u => ({
    username: u.username,
    role: u.role,
    createdAt: u.createdAt,
    immutable: u.immutable
  }));

  res.json(safe);
});

// ======================================================
// ANALYZE (PROTECTED)
// ======================================================

app.post("/analyze", authMiddleware, upload.array("images"), (req, res) => {

  const results = [];

  for (const file of req.files) {

    const url =
      `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;

    results.push({
      image: file.filename,
      url
    });
  }

  res.json({ results });
});

// ======================================================
// START SERVER
// ======================================================

server.listen(PORT, async () => {

  await createDefaultAdmin();

  console.log("🚀 Server running on port", PORT);
});
