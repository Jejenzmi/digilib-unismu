// src/routes/log.routes.js
const router   = require("express").Router();
const c        = require("../controllers/log.controller");
const { auth, kepalaOnly } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /api/log:
 *   get:
 *     tags: [Log]
 *     summary: Daftar activity log sistem (khusus Kepala)
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: userId
 *         schema: { type: integer }
 *         description: Filter log milik user tertentu
 *     responses:
 *       200:
 *         description: Daftar log aktivitas
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", auth, kepalaOnly, c.getAll);

/**
 * @swagger
 * /api/log/clear:
 *   delete:
 *     tags: [Log]
 *     summary: Hapus log aktivitas lama (khusus Kepala)
 *     description: Menghapus log yang lebih tua dari N hari (default 90 hari).
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               days:
 *                 type: integer
 *                 default: 90
 *                 description: Hapus log lebih tua dari N hari
 *     responses:
 *       200:
 *         description: Log lama berhasil dihapus
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
 *                         deleted: { type: integer }
 */
router.delete("/clear", auth, kepalaOnly, c.clear);

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
