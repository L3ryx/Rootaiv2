// ======================================================
// ROOT AI V2 - FINAL SECURE VERSION
// ======================================================

const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const USERS_PATH = "./users.json";
const SESSIONS_PATH = "./sessions.json";
const SESSION_DURATION = 1000 * 60 * 60; // 1 heure

// ======================================================
// BASIC CONFIG
// ======================================================

app.use(express.json());
app.use(cookieParser());

// ======================================================
// UTILS
// ======================================================

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file)); }
  catch { return fallback; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ======================================================
// CLEAR SESSIONS AU DÉMARRAGE
// ======================================================

writeJSON(SESSIONS_PATH, []);
console.log("🧹 Sessions cleared on startup");

// ======================================================
// CREATE DEFAULT ADMIN
// ======================================================

async function createAdmin() {

  const users = readJSON(USERS_PATH, []);

  if (users.find(u => u.username === "darkoff")) return;

  const hash = await bcrypt.hash("Bretigny91", 12);

  users.push({
    username: "darkoff",
    password: hash,
    role: "admin"
  });

  writeJSON(USERS_PATH, users);

  console.log("✅ Default admin created");
}

// ======================================================
// AUTH SYSTEM
// ======================================================

function getSession(token) {
  const sessions = readJSON(SESSIONS_PATH, []);
  const session = sessions.find(s => s.token === token);

  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_DURATION)
    return null;

  return session;
}

function requireAuth(req, res, next) {

  const token = req.cookies.session;
  const session = getSession(token);

  if (!session) {
    res.clearCookie("session");
    return res.redirect("/login");
  }

  req.user = session;
  next();
}

function requireAdmin(req, res, next) {

  const token = req.cookies.session;
  const session = getSession(token);

  if (!session || session.role !== "admin") {
    res.clearCookie("session");
    return res.redirect("/login");
  }

  req.user = session;
  next();
}

// ======================================================
// ROUTES HTML
// ======================================================

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.get("/dashboard", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/admin", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// ======================================================
// API LOGIN
// ======================================================

app.post("/api/login", async (req, res) => {

  const { username, password } = req.body;
  const users = readJSON(USERS_PATH, []);
  const user = users.find(u => u.username === username);

  if (!user)
    return res.status(401).json({ error: "User not found" });

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

  res.cookie("session", token, {
    httpOnly: true,
    secure: true,       // false en local
    sameSite: "strict",
    maxAge: SESSION_DURATION
  });

  res.json({ success: true });
});

// ======================================================
// LOGOUT
// ======================================================

app.post("/api/logout", (req, res) => {

  const token = req.cookies.session;

  let sessions = readJSON(SESSIONS_PATH, []);
  sessions = sessions.filter(s => s.token !== token);

  writeJSON(SESSIONS_PATH, sessions);

  res.clearCookie("session");

  res.json({ success: true });
});

// ======================================================
// STATIC FILES (PAS D'HTML)
// ======================================================

app.use("/assets", express.static(path.join(__dirname, "public/assets")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ======================================================
// START
// ======================================================

server.listen(PORT, async () => {
  await createAdmin();
  console.log("🚀 Server running on port", PORT);
});
