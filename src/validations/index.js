// src/validations/index.js
// Semua validation rules dalam satu file.
// Setiap rule pakai .trim().escape() untuk sanitasi XSS.
const { body, param } = require("express-validator");

const currentYear = new Date().getFullYear();

// ─── Auth ─────────────────────────────────────────────────────────────────────
const loginRules = [
  body("nim")
    .trim().notEmpty().withMessage("NIM wajib diisi.")
    .isLength({ max: 50 }).withMessage("NIM maksimal 50 karakter.")
    .escape(),
  body("password")
    .notEmpty().withMessage("Password wajib diisi.")
    .isLength({ max: 128 }).withMessage("Password terlalu panjang."),
    // Tidak di-escape agar karakter spesial tetap bisa dipakai di password
];

const changePasswordRules = [
  body("oldPassword").notEmpty().withMessage("Password lama wajib diisi."),
  body("newPassword")
    .notEmpty().withMessage("Password baru wajib diisi.")
    .isLength({ min: 8 }).withMessage("Password baru minimal 8 karakter.")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password harus mengandung huruf besar, huruf kecil, dan angka."),
];

const resetPasswordRules = [
  body("newPassword")
    .notEmpty().withMessage("Password baru wajib diisi.")
    .isLength({ min: 8 }).withMessage("Password minimal 8 karakter.")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password harus mengandung huruf besar, huruf kecil, dan angka."),
];

// ─── User ─────────────────────────────────────────────────────────────────────
const createUserRules = [
  body("name")
    .trim().notEmpty().withMessage("Nama wajib diisi.")
    .isLength({ min: 2, max: 200 }).withMessage("Nama harus 2–200 karakter.")
    .escape(),
  body("nim")
    .trim().notEmpty().withMessage("NIM wajib diisi.")
    .isLength({ max: 50 }).withMessage("NIM maksimal 50 karakter.")
    .matches(/^[a-zA-Z0-9]+$/).withMessage("NIM hanya boleh huruf dan angka.")
    .escape(),
  body("password")
    .notEmpty().withMessage("Password wajib diisi.")
    .isLength({ min: 8 }).withMessage("Password minimal 8 karakter.")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Password harus mengandung huruf besar, huruf kecil, dan angka."),
  body("role")
    .optional()
    .isIn(["kepala", "pustakawan", "mahasiswa", "umum"])
    .withMessage("Role tidak valid."),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail().withMessage("Format email tidak valid.")
    .isLength({ max: 100 }).withMessage("Email maksimal 100 karakter.")
    .normalizeEmail(),
  body("phone")
    .optional({ checkFalsy: true })
    .matches(/^[0-9+\-\s()]+$/).withMessage("Format nomor telepon tidak valid.")
    .isLength({ max: 20 }).withMessage("Nomor telepon maksimal 20 karakter.")
    .trim().escape(),
  body("angkatan")
    .optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage("Angkatan maksimal 10 karakter.")
    .escape(),
  body("tipe")
    .optional({ checkFalsy: true })
    .isIn(["Dosen", "Tenaga_Kependidikan", "Masyarakat"])
    .withMessage("Tipe tidak valid."),
  body("fakultasId")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage("Fakultas tidak valid.").toInt(),
  body("prodiId")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage("Program studi tidak valid.").toInt(),
  body("alamat")
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage("Alamat maksimal 500 karakter.")
    .escape(),
];

const updateUserRules = [
  body("name")
    .optional().trim()
    .isLength({ min: 2, max: 200 }).withMessage("Nama harus 2–200 karakter.")
    .escape(),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail().withMessage("Format email tidak valid.")
    .normalizeEmail(),
  body("phone")
    .optional({ checkFalsy: true })
    .matches(/^[0-9+\-\s()]+$/).withMessage("Format nomor telepon tidak valid.")
    .trim().escape(),
  body("alamat")
    .optional({ checkFalsy: true })
    .trim().isLength({ max: 500 }).withMessage("Alamat maksimal 500 karakter.")
    .escape(),
  body("angkatan")
    .optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage("Angkatan maksimal 10 karakter.")
    .escape(),
  body("tipe")
    .optional({ checkFalsy: true })
    .isIn(["Dosen", "Tenaga_Kependidikan", "Masyarakat"])
    .withMessage("Tipe tidak valid."),
  body("fakultasId")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage("Fakultas tidak valid.").toInt(),
  body("prodiId")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage("Program studi tidak valid.").toInt(),
];

// ─── Book ─────────────────────────────────────────────────────────────────────
const createBookRules = [
  body("title")
    .trim().notEmpty().withMessage("Judul buku wajib diisi.")
    .isLength({ max: 300 }).withMessage("Judul maksimal 300 karakter.")
    .escape(),
  body("author")
    .trim().notEmpty().withMessage("Penulis wajib diisi.")
    .isLength({ max: 200 }).withMessage("Nama penulis maksimal 200 karakter.")
    .escape(),
  body("year")
    .notEmpty().withMessage("Tahun terbit wajib diisi.")
    .isInt({ min: 1000, max: currentYear + 1 })
    .withMessage(`Tahun terbit harus antara 1000–${currentYear + 1}.`)
    .toInt(),
  body("category")
    .trim().notEmpty().withMessage("Kategori wajib diisi.")
    .isLength({ max: 100 }).withMessage("Kategori maksimal 100 karakter.")
    .escape(),
  body("isbn")
    .optional({ checkFalsy: true })
    .matches(/^[\d\-X]+$/).withMessage("Format ISBN tidak valid.")
    .isLength({ max: 50 }).withMessage("ISBN maksimal 50 karakter.")
    .trim(),
  body("stok")
    .optional().isInt({ min: 0 }).withMessage("Stok tidak boleh negatif.").toInt(),
  body("pages")
    .optional().isInt({ min: 0 }).withMessage("Jumlah halaman tidak valid.").toInt(),
  body("lokasi")
    .optional({ checkFalsy: true }).trim()
    .isLength({ max: 100 }).withMessage("Lokasi maksimal 100 karakter.")
    .escape(),
  body("abstract")
    .optional({ checkFalsy: true }).trim()
    .isLength({ max: 2000 }).withMessage("Abstrak maksimal 2000 karakter."),
  body("badge")
    .optional({ checkFalsy: true })
    .isIn(["", "Baru", "Populer", "Best Seller"])
    .withMessage("Badge tidak valid."),
  body("coverColor1")
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage("coverColor1 harus format hex (#rrggbb)."),
  body("coverColor2")
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage("coverColor2 harus format hex (#rrggbb)."),
];

const updateBookRules = [
  body("title")
    .optional().trim()
    .isLength({ min: 1, max: 300 }).withMessage("Judul 1–300 karakter.")
    .escape(),
  body("year")
    .optional()
    .isInt({ min: 1000, max: currentYear + 1 }).withMessage("Tahun tidak valid.").toInt(),
  body("stok")
    .optional().isInt({ min: 0 }).withMessage("Stok tidak boleh negatif.").toInt(),
  body("badge")
    .optional({ checkFalsy: true })
    .isIn(["", "Baru", "Populer", "Best Seller"])
    .withMessage("Badge tidak valid."),
];

// ─── Peminjaman ───────────────────────────────────────────────────────────────
const pinjamRules = [
  body("bookId")
    .notEmpty().withMessage("ID buku wajib diisi.")
    .isInt({ min: 1 }).withMessage("ID buku tidak valid.").toInt(),
  body("durasi")
    .optional()
    .isInt({ min: 1, max: 60 }).withMessage("Durasi peminjaman antara 1–60 hari.").toInt(),
];

const verifyTokenRules = [
  body("token")
    .trim().notEmpty().withMessage("Token wajib diisi."),
  body("bookId")
    .optional()
    .isInt({ min: 1 }).withMessage("ID buku tidak valid.").toInt(),
];

// ─── Fakultas & Prodi ─────────────────────────────────────────────────────────
const createFakultasRules = [
  body("nama")
    .trim().notEmpty().withMessage("Nama fakultas wajib diisi.")
    .isLength({ max: 150 }).withMessage("Nama maksimal 150 karakter.")
    .escape(),
  body("kode")
    .trim().notEmpty().withMessage("Kode fakultas wajib diisi.")
    .isLength({ max: 20 }).withMessage("Kode maksimal 20 karakter.")
    .matches(/^[a-zA-Z0-9]+$/).withMessage("Kode hanya boleh huruf dan angka.")
    .escape(),
  body("warna")
    .optional({ checkFalsy: true })
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage("Warna harus format hex (#rrggbb)."),
];

const createProdiRules = [
  body("nama")
    .trim().notEmpty().withMessage("Nama program studi wajib diisi.")
    .isLength({ max: 150 }).withMessage("Nama maksimal 150 karakter.")
    .escape(),
  body("kode")
    .trim().notEmpty().withMessage("Kode program studi wajib diisi.")
    .isLength({ max: 20 }).withMessage("Kode maksimal 20 karakter.")
    .matches(/^[a-zA-Z0-9]+$/).withMessage("Kode hanya boleh huruf dan angka.")
    .escape(),
  body("jenjang")
    .optional()
    .isIn(["D3", "D4", "S1", "S2", "S3"])
    .withMessage("Jenjang tidak valid."),
];

module.exports = {
  loginRules, changePasswordRules, resetPasswordRules,
  createUserRules, updateUserRules,
  createBookRules, updateBookRules,
  pinjamRules, verifyTokenRules,
  createFakultasRules, createProdiRules,
};
