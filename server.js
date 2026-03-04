// ======================================================
// ALI SEARCH AI - HTTP ONLY COOKIE VERSION
// ======================================================

const express = require("express");
const multer = require("multer");
const http = require("http");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

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

  console.log("🚀 Admin created");
}

// ======================================================
// AUTH MIDDLEWARE (COOKIE BASED)
// ======================================================

function authMiddleware(req, res, next) {

  const token = req.cookies.session;

  if (!token)
    return res.status(401).json({ error: "Not authenticated" });

  const sessions = readJSON(SESSIONS_PATH, []);
  const session = sessions.find(s => s.token === token);

  if (!session)
    return res.status(401).json({ error: "Invalid session" });

  if (Date.now() - session.createdAt > SESSION_DURATION)
    return res.status(401).json({ error: "Session expired" });

  req.user = session;
  next();
}

function adminMiddleware(req, res, next) {

  const token = req.cookies.session;

  const sessions = readJSON(SESSIONS_PATH, []);
  const session = sessions.find(
    s => s.token === token && s.role === "admin"
  );

  if (!session)
    return res.status(403).json({ error: "Admin only" });

  req.user = session;
  next();
}

// ======================================================
// LOGIN (SET HTTP ONLY COOKIE)
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

  // 🔥 COOKIE SECURE + HTTP ONLY
  res.cookie("session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: SESSION_DURATION
  });

  res.json({ success: true, role: user.role });
});

// ======================================================
// VERIFY SESSION
// ======================================================

app.get("/api/verify", authMiddleware, (req, res) => {

  res.json({
    valid: true,
    user: req.user.username,
    role: req.user.role
  });

});

// ======================================================
// LOGOUT (CLEAR COOKIE)
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
// ANALYZE PROTECTED
// ======================================================

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir))
  fs.mkdirSync(uploadDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) =>
      cb(null, Date.now() + "-" + file.originalname)
  })
});

app.post("/analyze", authMiddleware, upload.array("images"), (req, res) => {

  const results = req.files.map(file => ({
    image: file.filename,
    url: `/uploads/${file.filename}`
  }));

  res.json({ results });
});

// ======================================================
// START
// ======================================================

server.listen(PORT, async () => {
  await createAdmin();
  console.log("🚀 Server running on port", PORT);
});
