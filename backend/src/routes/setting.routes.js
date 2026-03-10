// src/routes/setting.routes.js
const router   = require("express").Router();
const c        = require("../controllers/setting.controller");
const { auth, kepalaOnly } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Ambil semua setting sistem (publik)
 *     description: Mengembalikan objek flat {key → value} dari semua pengaturan sistem.
 *     security: []
 *     responses:
 *       200:
 *         description: Semua setting berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       example:
 *                         nama_perpustakaan: "Perpustakaan UNISMU"
 *                         durasi_pinjam: "14"
 *                         denda_per_hari: "1000"
 */
router.get("/", c.getAll);

/**
 * @swagger
 * /api/settings/{key}:
 *   get:
 *     tags: [Settings]
 *     summary: Ambil satu setting berdasarkan key
 *     security: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *         example: denda_per_hari
 *     responses:
 *       200:
 *         description: Setting ditemukan
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:key", c.getOne);

/**
 * @swagger
 * /api/settings:
 *   put:
 *     tags: [Settings]
 *     summary: Update banyak setting sekaligus (khusus Kepala)
 *     description: |
 *       Kirim objek `{key: value, ...}`. Maks 50 key per request.
 *       Jika key belum ada, akan dibuat otomatis (upsert).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             example:
 *               denda_per_hari: "2000"
 *               max_pinjam: "5"
 *               durasi_pinjam: "21"
 *     responses:
 *       200:
 *         description: Setting berhasil disimpan
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put("/", auth, kepalaOnly, c.updateMany);

/**
 * @swagger
 * /api/settings/{key}:
 *   put:
 *     tags: [Settings]
 *     summary: Update satu setting berdasarkan key (khusus Kepala)
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value: { type: string, example: "2000" }
 *     responses:
 *       200:
 *         description: Setting berhasil diperbarui
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put("/:key", auth, kepalaOnly, c.updateOne);

module.exports = router;
