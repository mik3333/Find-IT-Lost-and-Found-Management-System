const db = require("../db");

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  const user = db.prepare("SELECT role FROM users WHERE id = ?").get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  req.session.role = user.role;
  next();
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (req.session.role !== "admin") {
      return res.status(403).json({ error: "Admin access required." });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
