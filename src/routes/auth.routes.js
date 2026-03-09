// src/routes/auth.routes.js
const router      = require("express").Router();
const rateLimit   = require("express-rate-limit");
const c           = require("../controllers/auth.controller");
const { auth }    = require("../middleware/auth.middleware");
const validate    = require("../middleware/validate.middleware");
const { loginRules, changePasswordRules } = require("../validations/index");
const { env }     = require("../config/env");

// Login lebih ketat — maks 10x per 15 menit per IP
const loginLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max:      env.loginRateLimitMax,
  skipSuccessfulRequests: false,
  message:  { success: false, message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.floor(env.rateLimitWindowMs / 60000)} menit.` },
  standardHeaders: true, legacyHeaders: false,
  // Lewati rate limit saat testing
  skip: () => env.isTest,
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login — dapatkan access token & refresh token
 *     description: |
 *       Rate-limited: **maks 10 percobaan per 15 menit** per IP.
 *       Pesan error identik untuk NIM salah & password salah (anti user enumeration).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             kepala:
 *               summary: Kepala Perpustakaan
 *               value: { nim: "KP001", password: "Admin@UNISMU2024" }
 *             mahasiswa:
 *               summary: Mahasiswa
 *               value: { nim: "2021001001", password: "Mahasiswa@123" }
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: NIM atau password salah
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         description: Terlalu banyak percobaan login
 */
router.post("/login", loginLimiter, loginRules, validate, c.login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Perbarui access token menggunakan refresh token
 *     description: |
 *       Refresh token dirotasi setiap kali digunakan (token lama diinvalidasi).
 *       Simpan refresh token baru dari respons ini.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token yang didapat saat login
 *     responses:
 *       200:
 *         description: Token berhasil diperbarui
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         accessToken:  { type: string }
 *                         refreshToken: { type: string, description: "Token baru — gantikan yang lama" }
 *       401:
 *         description: Refresh token tidak valid atau kedaluwarsa
 */
router.post("/refresh", c.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout — invalidasi refresh token
 *     description: Mengirim refreshToken akan memastikan sesi tidak bisa digunakan lagi.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logout berhasil
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/logout", auth, c.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Data user yang sedang login
 *     description: Mengembalikan profil lengkap user aktif. Field `password` tidak dikembalikan.
 *     responses:
 *       200:
 *         description: Data user berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/me", auth, c.me);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Ganti password sendiri
 *     description: |
 *       Setelah ganti password, **semua sesi aktif** (semua device) akan otomatis dilogout.
 *       User harus login ulang dengan password baru.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: Password lama salah
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put("/change-password", auth, changePasswordRules, validate, c.changePassword);

module.exports = router;
