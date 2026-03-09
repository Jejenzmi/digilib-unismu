// src/routes/fakultas.routes.js
//
// ⚠️  PENTING — URUTAN ROUTE:
// Route statis (/prodi/:prodiId) HARUS didaftarkan SEBELUM route dinamis (/:id).
// Jika tidak, Express akan menangkap "/prodi" sebagai nilai ":id" → SALAH.
//
const router   = require("express").Router();
const c        = require("../controllers/fakultas.controller");
const { auth, kepalaOnly, optionalAuth } = require("../middleware/auth.middleware");
const validate = require("../middleware/validate.middleware");
const { createFakultasRules, createProdiRules } = require("../validations/index");

// ─── PRODI routes (statis — HARUS di atas /:id) ──────────────────────────────

/**
 * @swagger
 * /api/fakultas/prodi/{prodiId}:
 *   put:
 *     tags: [Fakultas]
 *     summary: Perbarui program studi (khusus Kepala)
 *     parameters:
 *       - in: path
 *         name: prodiId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:     { type: string }
 *               kode:     { type: string }
 *               jenjang:  { type: string, enum: [D3, D4, S1, S2, S3] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Program studi berhasil diperbarui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put ("/prodi/:prodiId", auth, kepalaOnly, c.updateProdi);

/**
 * @swagger
 * /api/fakultas/prodi/{prodiId}:
 *   delete:
 *     tags: [Fakultas]
 *     summary: Nonaktifkan program studi (khusus Kepala)
 *     description: Tidak bisa dihapus jika masih ada anggota aktif di prodi ini.
 *     parameters:
 *       - in: path
 *         name: prodiId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Program studi berhasil dinonaktifkan
 *       400:
 *         description: Masih ada anggota aktif
 */
router.delete("/prodi/:prodiId", auth, kepalaOnly, c.removeProdi);

// ─── FAKULTAS routes ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/fakultas:
 *   get:
 *     tags: [Fakultas]
 *     summary: Daftar fakultas beserta program studi (publik)
 *     security: []
 *     parameters:
 *       - in: query
 *         name: withInactive
 *         schema: { type: boolean }
 *         description: Tampilkan juga yang nonaktif (admin only)
 *     responses:
 *       200:
 *         description: Daftar fakultas berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:     { type: integer }
 *                           nama:   { type: string }
 *                           kode:   { type: string }
 *                           warna:  { type: string }
 *                           prodi:  { type: array }
 */
router.get("/", optionalAuth, c.getAll);

/**
 * @swagger
 * /api/fakultas:
 *   post:
 *     tags: [Fakultas]
 *     summary: Tambah fakultas baru (khusus Kepala)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nama, kode]
 *             properties:
 *               nama:  { type: string, example: "Fakultas Teknik Informatika" }
 *               kode:  { type: string, example: "FTI" }
 *               warna: { type: string, example: "#6366f1" }
 *     responses:
 *       201:
 *         description: Fakultas berhasil ditambahkan
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: Kode fakultas sudah digunakan
 */
router.post("/", auth, kepalaOnly, createFakultasRules, validate, c.create);

/**
 * @swagger
 * /api/fakultas/{id}:
 *   get:
 *     tags: [Fakultas]
 *     summary: Detail satu fakultas beserta program studi
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detail fakultas
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", optionalAuth, c.getOne);

/**
 * @swagger
 * /api/fakultas/{id}:
 *   put:
 *     tags: [Fakultas]
 *     summary: Perbarui data fakultas (khusus Kepala)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:     { type: string }
 *               kode:     { type: string }
 *               warna:    { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Fakultas berhasil diperbarui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", auth, kepalaOnly, c.update);

/**
 * @swagger
 * /api/fakultas/{id}:
 *   delete:
 *     tags: [Fakultas]
 *     summary: Nonaktifkan fakultas (khusus Kepala)
 *     description: Tidak bisa dihapus jika masih ada anggota aktif di fakultas ini.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Fakultas berhasil dinonaktifkan
 *       400:
 *         description: Masih ada anggota aktif
 */
router.delete("/:id", auth, kepalaOnly, c.remove);

/**
 * @swagger
 * /api/fakultas/{id}/prodi:
 *   post:
 *     tags: [Fakultas]
 *     summary: Tambah program studi ke fakultas (khusus Kepala)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nama, kode]
 *             properties:
 *               nama:    { type: string, example: "S1 Teknik Informatika" }
 *               kode:    { type: string, example: "TI01" }
 *               jenjang: { type: string, enum: [D3, D4, S1, S2, S3], default: S1 }
 *     responses:
 *       201:
 *         description: Program studi berhasil ditambahkan
 *       404:
 *         description: Fakultas tidak ditemukan
 *       409:
 *         description: Kode program studi sudah digunakan
 */
router.post("/:id/prodi", auth, kepalaOnly, createProdiRules, validate, c.addProdi);

module.exports = router;
