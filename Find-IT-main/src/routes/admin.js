const express = require("express");
const db = require("../db");
const { publicUser } = require("../lib/mappers");
const { requireAdmin } = require("../lib/middleware");
const archive = require("../archive");

const router = express.Router();

router.get("/api/admin/overview", requireAdmin, (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
         (SELECT COUNT(*) FROM items) AS items,
         (SELECT COUNT(*) FROM items WHERE report_type = 'lost') AS lost,
         (SELECT COUNT(*) FROM items WHERE report_type = 'found') AS found,
         (SELECT COUNT(*) FROM claims WHERE status = 'pending') AS pendingClaims,
         (SELECT COUNT(*) FROM items WHERE status = 'reported') AS reported,
         (SELECT COUNT(*) FROM items WHERE status = 'claimed') AS claimed,
         (SELECT COUNT(*) FROM items WHERE status = 'returned') AS returned,
         (SELECT COUNT(*) FROM items WHERE status = 'closed') AS closed`
    )
    .get();

  const byCategory = db
    .prepare(
      `SELECT category, COUNT(*) AS count FROM items GROUP BY category ORDER BY count DESC`
    )
    .all();

  const recentItems = db
    .prepare(
      `SELECT i.id, i.title, i.report_type, i.status, i.created_at, u.username
       FROM items i JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC LIMIT 8`
    )
    .all();

  const pendingClaims = db
    .prepare(
      `SELECT c.id, c.message, c.image_path, c.created_at, c.item_id, i.title, u.username
       FROM claims c
       JOIN items i ON i.id = c.item_id
       JOIN users u ON u.id = c.user_id
       WHERE c.status = 'pending'
       ORDER BY c.created_at ASC`
    )
    .all();

  const users = db
    .prepare(
      `SELECT id, email, username, role, created_at, profile_picture FROM users ORDER BY created_at DESC`
    )
    .all();

  const threads = db
    .prepare(
      `SELECT i.id, i.title, i.report_type, i.status, i.created_at, u.username
       FROM items i JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC`
    )
    .all();

  res.json({
    totals,
    byCategory,
    recentItems,
    pendingClaims,
    users: users.map(publicUser),
    threads
  });
});

router.get("/api/admin/archive", requireAdmin, (_req, res) => {
  res.json({ entries: archive.listArchives() });
});

router.patch("/api/admin/users/:id/role", requireAdmin, (req, res) => {
  const role = req.body.role;
  if (!["user", "admin"].includes(role)) {
    return res.status(400).json({ error: "Choose a valid user role." });
  }
  const user = db.prepare("SELECT id, role FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (Number(user.id) === Number(req.session.userId) && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own administrator role." });
  }
  if (user.role === "admin" && role !== "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
    if (admins.count <= 1) {
      return res.status(400).json({ error: "At least one administrator account must remain." });
    }
  }
  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, user.id);
  res.json({ ok: true, role });
});

router.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (Number(user.id) === Number(req.session.userId)) {
    return res.status(400).json({ error: "You cannot delete your own administrator account." });
  }
  if (user.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
    if (admins.count <= 1) {
      return res.status(400).json({ error: "At least one administrator account must remain." });
    }
  }

  const items = db.prepare("SELECT * FROM items WHERE user_id = ?").all(user.id);
  const claims = db
    .prepare(
      `SELECT * FROM claims
       WHERE user_id = ? OR item_id IN (SELECT id FROM items WHERE user_id = ?)`
    )
    .all(user.id, user.id);
  const records = [
    ...claims.map((claim) => ({
      type: "claim",
      id: claim.id,
      summary: `Claim #${claim.id} (thread #${claim.item_id})`,
      payload: claim
    })),
    ...items.map((item) => ({
      type: "item",
      id: item.id,
      summary: item.title,
      payload: item
    })),
    {
      type: "user",
      id: user.id,
      summary: `${user.username} (${user.email})`,
      payload: user
    }
  ];

  archive.archiveAndDelete(db, records, () => {
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  });
  res.json({ ok: true, archived: records.length });
});

router.delete("/api/admin/items/:id", requireAdmin, (req, res) => {
  const item = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id);
  if (!item) return res.status(404).json({ error: "Thread not found." });
  const claims = db.prepare("SELECT * FROM claims WHERE item_id = ?").all(item.id);
  const records = [
    ...claims.map((claim) => ({
      type: "claim",
      id: claim.id,
      summary: `Claim #${claim.id} on ${item.title}`,
      payload: claim
    })),
    {
      type: "item",
      id: item.id,
      summary: item.title,
      payload: item
    }
  ];

  archive.archiveAndDelete(db, records, () => {
    db.prepare("DELETE FROM items WHERE id = ?").run(item.id);
  });
  res.json({ ok: true, archived: records.length });
});

router.post("/api/admin/archive/:id/restore", requireAdmin, (req, res) => {
  const entry = archive.getArchive(req.params.id);
  if (!entry) return res.status(404).json({ error: "Archived record not found." });
  const record = JSON.parse(entry.payload);

  db.exec("BEGIN");
  try {
    if (entry.record_type === "user") {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, username, profile_picture, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        record.id,
        record.email,
        record.password_hash,
        record.username,
        record.profile_picture,
        record.role,
        record.created_at
      );
    } else if (entry.record_type === "item") {
      const owner = db.prepare("SELECT id FROM users WHERE id = ?").get(record.user_id);
      if (!owner) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Restore the thread owner's account first." });
      }
      db.prepare(
        `INSERT INTO items (id, user_id, report_type, title, description, category, location, incident_date, image_path, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        record.id,
        record.user_id,
        record.report_type,
        record.title,
        record.description,
        record.category,
        record.location,
        record.incident_date,
        record.image_path,
        record.status,
        record.created_at,
        record.updated_at
      );
    } else if (entry.record_type === "claim") {
      const item = db.prepare("SELECT id FROM items WHERE id = ?").get(record.item_id);
      const user = db.prepare("SELECT id FROM users WHERE id = ?").get(record.user_id);
      if (!item || !user) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Restore the associated account and thread first." });
      }
      db.prepare(
        `INSERT INTO claims (id, item_id, user_id, message, image_path, status, admin_note, created_at, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        record.id,
        record.item_id,
        record.user_id,
        record.message,
        record.image_path,
        record.status,
        record.admin_note,
        record.created_at,
        record.reviewed_at
      );
    } else {
      throw new Error("Archived record type is invalid.");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (error.errcode === 1555 || error.errcode === 2067) {
      return res.status(409).json({ error: "A record with conflicting account details or ID already exists." });
    }
    throw error;
  }

  archive.removeArchive(entry.id);
  res.json({ ok: true, type: entry.record_type });
});

router.patch("/api/admin/claims/:id", requireAdmin, (req, res) => {
  const status = req.body.status;
  const adminNote = String(req.body.adminNote || "").trim();
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Claim must be approved or rejected." });
  }
  const claim = db.prepare("SELECT * FROM claims WHERE id = ?").get(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found." });
  if (claim.status !== "pending") {
    return res.status(400).json({ error: "This claim was already reviewed." });
  }

  db.prepare(
    "UPDATE claims SET status = ?, admin_note = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(status, adminNote || null, claim.id);

  if (status === "approved") {
    db.prepare("UPDATE items SET status = 'claimed', updated_at = datetime('now') WHERE id = ?").run(
      claim.item_id
    );
    db.prepare(
      "UPDATE claims SET status = 'rejected', admin_note = 'Another claim was approved.', reviewed_at = datetime('now') WHERE item_id = ? AND id != ? AND status = 'pending'"
    ).run(claim.item_id, claim.id);
  }
  res.json({ ok: true });
});

module.exports = router;
