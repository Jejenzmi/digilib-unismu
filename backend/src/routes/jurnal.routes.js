// src/routes/jurnal.routes.js
const router   = require("express").Router();
const c        = require("../controllers/jurnal.controller");
const { auth, adminOnly, kepalaOnly } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /api/jurnal:
 *   get:
 *     tags: [Jurnal]
 *     summary: Daftar jurnal ilmiah (publik)
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Daftar jurnal berhasil diambil
 */
router.get("/", c.getAll);

/**
 * @swagger
 * /api/jurnal/{id}:
 *   get:
 *     tags: [Jurnal]
 *     summary: Detail satu jurnal
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detail jurnal
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", c.getOne);

/**
 * @swagger
 * /api/jurnal:
 *   post:
 *     tags: [Jurnal]
 *     summary: Tambah jurnal baru (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, year]
 *             properties:
 *               title:     { type: string }
 *               issn:      { type: string }
 *               issnE:     { type: string }
 *               volume:    { type: string }
 *               year:      { type: integer }
 *               articles:  { type: integer }
 *               editor:    { type: string }
 *               penerbit:  { type: string }
 *               frekuensi: { type: string }
 *               warna:     { type: string }
 *               isActive:  { type: boolean }
 *     responses:
 *       201:
 *         description: Jurnal berhasil ditambahkan
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post("/", auth, adminOnly, c.create);

/**
 * @swagger
 * /api/jurnal/{id}:
 *   put:
 *     tags: [Jurnal]
 *     summary: Perbarui jurnal (admin)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Jurnal berhasil diperbarui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", auth, adminOnly, c.update);

/**
 * @swagger
 * /api/jurnal/{id}:
 *   delete:
 *     tags: [Jurnal]
 *     summary: Hapus jurnal (khusus Kepala)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Jurnal berhasil dihapus
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id", auth, kepalaOnly, c.remove);

module.exports = router;
