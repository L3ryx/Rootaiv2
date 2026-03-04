// ======================================================
// ALI SEARCH AI - PROTECTED VERSION
// ======================================================

const express = require("express");
const multer = require("multer");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = "darkoff";
const ADMIN_PASSWORD_PLAIN = "Bretigny91";

const USERS_PATH = "./users.json";
const SESSIONS_PATH = "./sessions.json";

const SESSION_DURATION = 1000 * 60 * 60;

// ======================================================
// UTILS
// ======================================================

function readJSON(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ======================================================
// AUTO ADMIN
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

  console.log("🚀 Admin created");
}

// ======================================================
// CLEAN SESSIONS
// ======================================================

function cleanSessions() {

  const sessions = readJSON(SESSIONS_PATH, []);
  const now = Date.now();

  const active = sessions.filter(
    s => now - s.createdAt < SESSION_DURATION
  );

  writeJSON(SESSIONS_PATH, active);
}

setInterval(cleanSessions, 600000);

// ======================================================
// MIDDLEWARE
// ======================================================

function authMiddleware(req, res, next) {

  const token = req.headers.authorization;

  if (!token)
    return res.status(401).json({ error: "No token" });

  cleanSessions();

  const sessions = readJSON(SESSIONS_PATH, []);
  const session = sessions.find(s => s.token === token);

  if (!session)
    return res.status(401).json({ error: "Invalid token" });

  req.user = session;
  next();
}

function adminMiddleware(req, res, next) {

  const token = req.headers.authorization;

  cleanSessions();

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
app.use(express.static(path.join(__dirname, "public")));

const uploadDir = path.join(__dirname, "uploads");
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
// FRONTEND ROUTES
// ======================================================

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

app.get("/login", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "login.html"))
);

app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "register.html"))
);

app.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "admin.html"))
);

// ======================================================
// REGISTER
// ======================================================

app.post("/api/register", async (req, res) => {

  const { username, password } = req.body;

  const users = readJSON(USERS_PATH, []);

  if (users.find(u => u.username === username))
    return res.status(400).json({ error: "User exists" });

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
// VERIFY TOKEN
// ======================================================

app.get("/api/verify", authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
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
// ADMIN ROUTE
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
// ANALYZE
// ======================================================

app.post("/analyze", authMiddleware, upload.array("images"), (req, res) => {

  const results = req.files.map(file => ({
    image: file.filename,
    url: `/uploads/${file.filename}`
  }));

  res.json({ results });
});

// ======================================================
// START SERVER
// ======================================================

server.listen(PORT, async () => {
  await createDefaultAdmin();
  console.log("🚀 Server running on port", PORT);
});
