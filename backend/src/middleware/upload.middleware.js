// src/middleware/upload.middleware.js
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const { env }  = require("../config/env");

const mkDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };

const storage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), env.uploadPath, folder);
      mkDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${Math.floor(Math.random() * 1e6)}${ext}`;
      cb(null, name);
    },
  });

// ─── Magic bytes validation ────────────────────────────────────────────────────
// Memvalidasi signature byte dari isi file — bukan hanya Content-Type header
// yang dikirim client dan mudah dipalsukan.
//
// PDF  : dimulai dengan 0x25 0x50 0x44 0x46 (%PDF)
// JPEG : dimulai dengan 0xFF 0xD8 0xFF
// PNG  : dimulai dengan 0x89 0x50 0x4E 0x47 (‰PNG)
// WebP : byte 8–11 adalah W E B P (setelah RIFF header 4 byte + size 4 byte)

function readMagicBytes(filePath, length = 12) {
  const buf = Buffer.alloc(length);
  const fd  = fs.openSync(filePath, "r");
  try { fs.readSync(fd, buf, 0, length, 0); } finally { fs.closeSync(fd); }
  return buf;
}

function isPdf(filePath) {
  try {
    const magic = readMagicBytes(filePath, 4);
    return magic.toString("ascii") === "%PDF";
  } catch { return false; }
}

function isImage(filePath) {
  try {
    const magic = readMagicBytes(filePath, 12);
    const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8 && magic[2] === 0xFF;
    const isPng  = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4E && magic[3] === 0x47;
    const isWebp = magic.slice(0, 4).toString("ascii") === "RIFF" &&
                   magic.slice(8, 12).toString("ascii") === "WEBP";
    return isJpeg || isPng || isWebp;
  } catch { return false; }
}

// ─── Filters ───────────────────────────────────────────────────────────────────
// Multer filter dijalankan SEBELUM file ditulis ke disk — di sini kita hanya
// bisa cek Content-Type header (yang bisa dipalsukan). Validasi magic bytes
// dilakukan via middleware pasca-upload di bawah.

const pdfFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  // Tolak di sini jika Content-Type jelas-jelas salah (defense in depth)
  if (file.mimetype === "application/pdf" && ext === ".pdf") return cb(null, true);
  cb(Object.assign(new Error("Hanya file PDF (.pdf) yang diizinkan."), { status: 400 }), false);
};

const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(Object.assign(new Error("Hanya file gambar JPG, PNG, atau WebP yang diizinkan."), { status: 400 }), false);
};

// ─── Pasca-upload: validasi magic bytes ──────────────────────────────────────
// Middleware ini dijalankan SETELAH multer menyimpan file ke disk.
// Jika magic bytes tidak cocok, file dihapus dan request ditolak.

function validatePdfMagic(req, res, next) {
  if (!req.file) return next();
  if (isPdf(req.file.path)) return next();
  // Magic bytes tidak cocok — hapus file dan tolak
  fs.unlink(req.file.path, () => {});
  return res.status(400).json({
    success: false,
    message: "File yang diupload bukan PDF yang valid.",
    requestId: res.locals.requestId,
  });
}

function validateImageMagic(req, res, next) {
  if (!req.file) return next();
  if (isImage(req.file.path)) return next();
  fs.unlink(req.file.path, () => {});
  return res.status(400).json({
    success: false,
    message: "File yang diupload bukan gambar yang valid (JPG/PNG/WebP).",
    requestId: res.locals.requestId,
  });
}

const MB = 1024 * 1024;

module.exports = {
  uploadBook:    multer({ storage: storage("books"),   fileFilter: pdfFilter,   limits: { fileSize: env.maxFileSizeMb * MB } }),
  uploadSkripsi: multer({ storage: storage("skripsi"), fileFilter: pdfFilter,   limits: { fileSize: env.maxFileSizeMb * MB } }),
  uploadAvatar:  multer({ storage: storage("avatar"),  fileFilter: imageFilter, limits: { fileSize: 3 * MB } }),
  // Menangani PDF + cover image dalam satu request multipart (fields: "file" + "cover")
  uploadBookWithCover: multer({ storage: storage("books"), limits: { fileSize: env.maxFileSizeMb * MB } }).fields([
    { name: "file",  maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]),
  // Middleware validasi magic bytes — pasang SETELAH multer di route
  validatePdfMagic,
  validateImageMagic,
};
