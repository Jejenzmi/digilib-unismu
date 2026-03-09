// src/routes/bookmark.routes.js
const router   = require("express").Router();
const c        = require("../controllers/bookmark.controller");
const { auth } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /api/bookmark:
 *   get:
 *     tags: [Bookmark]
 *     summary: Daftar buku yang di-bookmark oleh user yang sedang login
 *     responses:
 *       200:
 *         description: Daftar buku bookmark
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
 *                         $ref: '#/components/schemas/Book'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get("/", auth, c.getAll);

/**
 * @swagger
 * /api/bookmark/{bookId}:
 *   post:
 *     tags: [Bookmark]
 *     summary: Toggle bookmark (tambah atau hapus)
 *     description: |
 *       Jika buku belum di-bookmark → ditambahkan (`bookmarked: true`).
 *       Jika sudah di-bookmark → dihapus (`bookmarked: false`).
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status bookmark berhasil diubah
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
 *                         bookmarked: { type: boolean }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Buku tidak ditemukan
 */
router.post("/:bookId", auth, c.toggle);

/**
 * @swagger
 * /api/bookmark/{bookId}/check:
 *   get:
 *     tags: [Bookmark]
 *     summary: Cek apakah buku sudah di-bookmark user
 *     parameters:
 *       - in: path
 *         name: bookId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status bookmark
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
 *                         bookmarked: { type: boolean }
 */
router.get("/:bookId/check", auth, c.check);

module.exports = router;
