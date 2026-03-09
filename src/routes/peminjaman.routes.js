// src/routes/peminjaman.routes.js
const router   = require("express").Router();
const c        = require("../controllers/peminjaman.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { pinjamRules, verifyTokenRules } = require("../validations/index");

/**
 * @swagger
 * /api/peminjaman:
 *   get:
 *     tags: [Peminjaman]
 *     summary: Daftar peminjaman
 *     description: |
 *       - **Admin**: melihat semua peminjaman, bisa filter by userId/bookId/status
 *       - **User biasa**: hanya melihat peminjaman sendiri
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [dipinjam, dikembalikan, terlambat, hilang] }
 *       - in: query
 *         name: userId
 *         schema: { type: integer }
 *         description: Filter by user (admin only)
 *       - in: query
 *         name: bookId
 *         schema: { type: integer }
 *         description: Filter by buku
 *     responses:
 *       200:
 *         description: Daftar peminjaman
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Peminjaman'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", auth, c.getAll);

/**
 * @swagger
 * /api/peminjaman/{id}:
 *   get:
 *     tags: [Peminjaman]
 *     summary: Detail satu peminjaman
 *     description: User biasa hanya bisa melihat peminjaman miliknya.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detail peminjaman
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, c.getOne);

/**
 * @swagger
 * /api/peminjaman:
 *   post:
 *     tags: [Peminjaman]
 *     summary: Pinjam buku
 *     description: |
 *       Membuat record peminjaman baru. Token akses buku digital di-generate otomatis.
 *
 *       **Validasi:**
 *       - Buku harus aktif dan stok > 0
 *       - Belum pernah meminjam buku yang sama (status dipinjam/terlambat)
 *       - Belum melampaui batas maks. peminjaman (setting `max_pinjam`)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PinjamRequest'
 *     responses:
 *       201:
 *         description: Buku berhasil dipinjam, token akses tersedia di respons
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Peminjaman'
 *       400:
 *         description: Stok habis / sudah pinjam / melampaui limit
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/", auth, pinjamRules, validate, c.pinjam);

/**
 * @swagger
 * /api/peminjaman/verify-token:
 *   post:
 *     tags: [Peminjaman]
 *     summary: Verifikasi token akses buku digital
 *     description: |
 *       Cek apakah token akses masih valid. Digunakan sebelum membuka/membaca buku digital.
 *
 *       **Hasil:**
 *       - `valid: true` → buku boleh dibaca, `daysLeft` menunjukkan sisa hari
 *       - `valid: false, reason: "expired"` → token kedaluwarsa
 *       - `valid: false, reason: "wrong_book"` → token bukan untuk buku ini
 *       - `valid: false, reason: "invalid"` → format token salah atau bukan milik user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyTokenRequest'
 *     responses:
 *       200:
 *         description: Hasil verifikasi token (selalu 200, cek field `valid`)
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
 *                         valid:    { type: boolean }
 *                         reason:   { type: string, enum: [invalid, expired, wrong_book] }
 *                         daysLeft: { type: integer }
 *                         expiry:   { type: string, format: date-time }
 */
router.post("/verify-token", auth, verifyTokenRules, validate, c.verifyToken);

/**
 * @swagger
 * /api/peminjaman/{id}/kembalikan:
 *   put:
 *     tags: [Peminjaman]
 *     summary: Proses pengembalian buku (admin)
 *     description: |
 *       Mengubah status ke `dikembalikan`, mengembalikan stok, dan menghitung denda otomatis.
 *
 *       Denda = hari terlambat × setting `denda_per_hari` (default Rp 1.000/hari).
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Buku berhasil dikembalikan, denda tercantum jika ada
 *       400:
 *         description: Buku sudah dikembalikan sebelumnya
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id/kembalikan", auth, adminOnly, c.kembalikan);

/**
 * @swagger
 * /api/peminjaman/{id}/bayar-denda:
 *   put:
 *     tags: [Peminjaman]
 *     summary: Tandai denda sebagai lunas (admin)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Denda berhasil dilunasi
 *       400:
 *         description: Tidak ada denda atau sudah lunas
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put("/:id/bayar-denda", auth, adminOnly, c.bayarDenda);

module.exports = router;
