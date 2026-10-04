const path = require("path");
const multer = require("multer");

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(new Error("Only JPG, PNG, WEBP, or GIF images are allowed."));
      return;
    }
    cb(null, true);
  }
});

module.exports = { upload };
