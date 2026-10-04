const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { publicUser } = require("../lib/mappers");
const { requireAuth } = require("../lib/middleware");
const { upload } = require("../lib/upload");

const router = express.Router();

router.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  res.json({ user: publicUser(row) });
});

router.post("/api/auth/register", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ error: "Username must be 3–24 characters." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const exists = db
    .prepare("SELECT id FROM users WHERE email = ? OR username = ?")
    .get(email, username);
  if (exists) {
    return res.status(409).json({ error: "Email or username is already in use." });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, 'user')")
    .run(email, passwordHash, username);

  req.session.userId = Number(result.lastInsertRowid);
  req.session.role = "user";
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  res.status(201).json({ user: publicUser(user) });
});

router.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email or password." });
  }
  req.session.userId = Number(user.id);
  req.session.role = user.role;
  res.json({ user: publicUser(user) });
});

router.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("findit.sid");
    res.json({ ok: true });
  });
});

router.put("/api/auth/profile", requireAuth, upload.single("profilePicture"), (req, res) => {
  const username = String(req.body.username || "").trim();
  if (username.length < 3 || username.length > 24) {
    return res.status(400).json({ error: "Username must be 3–24 characters." });
  }
  const taken = db
    .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
    .get(username, req.session.userId);
  if (taken) return res.status(409).json({ error: "That username is already taken." });

  const current = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  const picture = req.file ? `/uploads/${req.file.filename}` : current.profile_picture;
  db.prepare("UPDATE users SET username = ?, profile_picture = ? WHERE id = ?").run(
    username,
    picture,
    req.session.userId
  );
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  res.json({ user: publicUser(user) });
});

router.put("/api/auth/password", requireAuth, (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = String(req.body.newPassword || "");
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.userId);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    bcrypt.hashSync(newPassword, 12),
    req.session.userId
  );
  res.json({ ok: true });
});

module.exports = router;
