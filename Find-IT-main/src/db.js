const fs = require("fs");
const path = require("path");
const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");

const dataDir = path.join(__dirname, "..", "data");
const uploadsDir = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, "findit.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    profile_picture TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('lost', 'found')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    location TEXT NOT NULL,
    incident_date TEXT NOT NULL,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'reported'
      CHECK (status IN ('reported', 'claimed', 'returned', 'closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_items_title ON items(title COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
`);

const claimColumns = db.prepare("PRAGMA table_info(claims)").all();
if (!claimColumns.some((column) => column.name === "image_path")) {
  db.exec("ALTER TABLE claims ADD COLUMN image_path TEXT");
}

db.prepare(
  "UPDATE users SET username = 'Admin' WHERE email = ? AND username = 'Campus Admin'"
).run("admin@findit.local");

function seed() {
  const adminEmail = "admin@findit.local";
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  if (existing) return;

  const adminPassword = randomBytes(24).toString("base64url");
  const userPassword = randomBytes(24).toString("base64url");
  const adminHash = bcrypt.hashSync(adminPassword, 12);
  const userHash = bcrypt.hashSync(userPassword, 12);

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, username, role)
    VALUES (?, ?, ?, ?)
  `);
  const admin = insertUser.run(adminEmail, adminHash, "Admin", "admin");
  const demo = insertUser.run("demo@findit.local", userHash, "Demo Student", "user");
  console.info(`Initial admin login: ${adminEmail} / ${adminPassword}`);
  console.info(`Initial demo login: demo@findit.local / ${userPassword}`);

  const insertItem = db.prepare(`
    INSERT INTO items (user_id, report_type, title, description, category, location, incident_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertItem.run(
    demo.lastInsertRowid,
    "lost",
    "Black Laptop Sleeve",
    "Lost a slim black 14-inch laptop sleeve near the library stairs. Contains a charger cable in the front pocket.",
    "Bags",
    "Main Library",
    "2026-09-28",
    "reported",
    "-2 days"
  );
  insertItem.run(
    admin.lastInsertRowid,
    "found",
    "Student ID Card",
    "Found a student ID card on a cafeteria table. Name is partially visible. Please describe the ID to claim.",
    "Documents",
    "Cafeteria",
    "2026-09-30",
    "reported",
    "-1 day"
  );
  insertItem.run(
    demo.lastInsertRowid,
    "lost",
    "Blue Water Bottle",
    "Stainless steel blue bottle with a dented lid. Left in Room 204 after CPE class.",
    "Other",
    "Engineering Building, Room 204",
    "2026-10-01",
    "reported",
    "-6 hours"
  );
}

seed();

module.exports = db;
