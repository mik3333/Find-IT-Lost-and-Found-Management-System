const path = require("path");
const express = require("express");
const session = require("express-session");
const multer = require("multer");
const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const adminRoutes = require("./routes/admin");

function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      name: "findit.sid",
      secret: process.env.SESSION_SECRET || "find-it-localhost-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 8
      }
    })
  );
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.use(authRoutes);
  app.use(itemRoutes);
  app.use(adminRoutes);

  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: "Image upload failed. Max size is 5MB." });
    }
    if (err) return res.status(400).json({ error: err.message || "Request failed." });
    res.status(500).json({ error: "Server error." });
  });

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Not found." });
    }
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
  });

  return app;
}

module.exports = { createApp };
