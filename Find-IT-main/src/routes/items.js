const express = require("express");
const db = require("../db");
const { mapItem } = require("../lib/mappers");
const { requireAuth, requireAdmin } = require("../lib/middleware");
const { upload } = require("../lib/upload");
const { CATEGORIES, STATUSES } = require("../constants");

const router = express.Router();

router.get("/api/meta", (_req, res) => {
  res.json({ categories: CATEGORIES, statuses: STATUSES });
});

router.get("/api/items", (req, res) => {
  const { category, reportType, sort, q, status } = req.query;
  const clauses = [];
  const params = [];

  if (category && CATEGORIES.includes(category)) {
    clauses.push("i.category = ?");
    params.push(category);
  }
  if (reportType && ["lost", "found"].includes(reportType)) {
    clauses.push("i.report_type = ?");
    params.push(reportType);
  }
  if (status && STATUSES.includes(status)) {
    clauses.push("i.status = ?");
    params.push(status);
  }
  if (q && String(q).trim()) {
    clauses.push("(i.title LIKE ? OR i.description LIKE ? OR i.location LIKE ?)");
    const like = `%${String(q).trim()}%`;
    params.push(like, like, like);
  }

  let order = "i.created_at DESC";
  if (sort === "az") order = "i.title COLLATE NOCASE ASC";
  if (sort === "za") order = "i.title COLLATE NOCASE DESC";
  if (sort === "oldest") order = "i.created_at ASC";

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT i.*, u.username, u.profile_picture, u.role
       FROM items i
       JOIN users u ON u.id = i.user_id
       ${where}
       ORDER BY ${order}`
    )
    .all(...params);

  res.json({ items: rows.map((row) => mapItem(row, req.session.userId)) });
});

router.get("/api/items/:id", (req, res) => {
  const row = db
    .prepare(
      `SELECT i.*, u.username, u.profile_picture, u.role
       FROM items i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`
    )
    .get(req.params.id);

  if (!row) return res.status(404).json({ error: "Item not found." });

  const claims = db
    .prepare(
      `SELECT c.id, c.user_id, c.message, c.image_path, c.status, c.created_at, c.admin_note, u.username, u.role
       FROM claims c JOIN users u ON u.id = c.user_id
       WHERE c.item_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(row.id);

  const visibleClaims =
    req.session.role === "admin" || row.user_id === req.session.userId
      ? claims
      : claims.filter((c) => c.user_id === req.session.userId);

  res.json({
    item: mapItem(row, req.session.userId),
    claims: visibleClaims.map((c) => ({
      id: c.id,
      message: c.message,
      imagePath: c.image_path,
      status: c.status,
      createdAt: c.created_at,
      adminNote: c.admin_note,
      username: c.username,
      role: c.role
    }))
  });
});

router.post("/api/items", requireAuth, upload.single("image"), (req, res) => {
  const reportType = req.body.reportType;
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const category = req.body.category;
  const location = String(req.body.location || "").trim();
  const incidentDate = String(req.body.incidentDate || "").trim();

  if (!["lost", "found"].includes(reportType)) {
    return res.status(400).json({ error: "Choose lost or found." });
  }
  if (!title || title.length > 80) {
    return res.status(400).json({ error: "Title is required (max 80 characters)." });
  }
  if (description.length < 10) {
    return res.status(400).json({ error: "Please add a description of at least 10 characters." });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Select a valid category." });
  }
  if (!location) return res.status(400).json({ error: "Location is required." });
  if (!incidentDate) return res.status(400).json({ error: "Date is required." });

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const result = db
    .prepare(
      `INSERT INTO items (user_id, report_type, title, description, category, location, incident_date, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.session.userId,
      reportType,
      title,
      description,
      category,
      location,
      incidentDate,
      imagePath
    );

  const row = db
    .prepare(
      `SELECT i.*, u.username, u.profile_picture, u.role
       FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?`
    )
    .get(Number(result.lastInsertRowid));

  res.status(201).json({ item: mapItem(row, req.session.userId) });
});

router.put("/api/items/:id", requireAuth, upload.single("image"), (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.user_id !== req.session.userId && req.session.role !== "admin") {
    return res.status(403).json({ error: "You can only edit your own posts." });
  }

  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const category = req.body.category;
  const location = String(req.body.location || "").trim();
  const incidentDate = String(req.body.incidentDate || "").trim();
  const reportType = req.body.reportType || item.report_type;

  if (!title || !CATEGORIES.includes(category) || !location || !incidentDate) {
    return res.status(400).json({ error: "Please complete all required fields." });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : item.image_path;
  db.prepare(
    `UPDATE items
     SET title = ?, description = ?, category = ?, location = ?, incident_date = ?, report_type = ?, image_path = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, description, category, location, incidentDate, reportType, imagePath, item.id);

  const row = db
    .prepare(
      `SELECT i.*, u.username, u.profile_picture, u.role
       FROM items i JOIN users u ON u.id = i.user_id WHERE i.id = ?`
    )
    .get(item.id);

  res.json({ item: mapItem(row, req.session.userId) });
});

router.patch("/api/items/:id/status", requireAdmin, (req, res) => {
  const status = req.body.status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });

  db.prepare("UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?").run(
    status,
    item.id
  );
  res.json({ ok: true, status });
});

router.post("/api/items/:id/claims", requireAuth, upload.single("proof"), (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.user_id === req.session.userId) {
    return res.status(400).json({ error: "You cannot claim your own report." });
  }
  if (item.status === "returned" || item.status === "closed") {
    return res.status(400).json({ error: "This item is no longer open for claims." });
  }

  const message = String(req.body.message || "").trim();
  if (message.length < 10) {
    return res.status(400).json({ error: "Describe why this item is yours (at least 10 characters)." });
  }

  const existing = db
    .prepare("SELECT id FROM claims WHERE item_id = ? AND user_id = ? AND status = 'pending'")
    .get(item.id, req.session.userId);
  if (existing) {
    return res.status(409).json({ error: "You already have a pending claim on this item." });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  db.prepare("INSERT INTO claims (item_id, user_id, message, image_path) VALUES (?, ?, ?, ?)").run(
    item.id,
    req.session.userId,
    message,
    imagePath
  );
  res.status(201).json({ ok: true });
});

router.get("/api/me/claims", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*, i.title, i.report_type, i.status AS item_status
       FROM claims c JOIN items i ON i.id = c.item_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(req.session.userId);

  res.json({
    claims: rows.map((r) => ({
      id: r.id,
      itemId: r.item_id,
      title: r.title,
      reportType: r.report_type,
      itemStatus: r.item_status,
      message: r.message,
      status: r.status,
      adminNote: r.admin_note,
      createdAt: r.created_at
    }))
  });
});

module.exports = router;
