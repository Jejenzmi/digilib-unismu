// src/routes/skripsi.routes.js
const router   = require("express").Router();
const c        = require("../controllers/skripsi.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const { uploadSkripsi, validatePdfMagic } = require("../middleware/upload.middleware");

/**
 * @swagger
 * /api/skripsi:
 *   get:
 *     tags: [Skripsi]
 *     summary: Daftar karya ilmiah (publik)
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: prodiId
 *         schema: { type: integer }
 *       - in: query
 *         name: isApproved
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Daftar karya ilmiah
 */
router.get("/", c.getAll);

/**
 * @swagger
 * /api/skripsi/{id}:
 *   get:
 *     tags: [Skripsi]
 *     summary: Detail satu karya ilmiah
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detail karya ilmiah
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", c.getOne);

/**
 * @swagger
 * /api/skripsi:
 *   post:
 *     tags: [Skripsi]
 *     summary: Upload karya ilmiah (wajib login)
 *     description: |
 *       - **Mahasiswa**: dikirim dengan status menunggu persetujuan (`isApproved: false`)
 *       - **Admin**: langsung disetujui (`isApproved: true`)
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, authorName]
 *             properties:
 *               title:      { type: string }
 *               authorName: { type: string }
 *               nim:        { type: string }
 *               tahun:      { type: integer }
 *               abstrak:    { type: string }
 *               pembimbing: { type: string }
 *               prodiId:    { type: integer }
 *               file:       { type: string, format: binary, description: "File PDF" }
 *     responses:
 *       201:
 *         description: Karya ilmiah berhasil diupload
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post("/", auth, uploadSkripsi.single("file"), validatePdfMagic, c.create);

/**
 * @swagger
 * /api/skripsi/{id}/approve:
 *   put:
 *     tags: [Skripsi]
 *     summary: Setujui karya ilmiah agar tampil di repositori (admin)
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Karya ilmiah disetujui
 *       400:
 *         description: Sudah disetujui sebelumnya
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.put("/:id/approve", auth, adminOnly, c.approve);

/**
 * @swagger
 * /api/skripsi/{id}:
 *   delete:
 *     tags: [Skripsi]
 *     summary: Hapus karya ilmiah (admin)
 *     description: File PDF juga ikut dihapus dari server.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Karya ilmiah berhasil dihapus
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.delete("/:id", auth, adminOnly, c.remove);

/**
 * @swagger
 * /api/skripsi/{id}/download:
 *   get:
 *     tags: [Skripsi]
 *     summary: Download PDF karya ilmiah (wajib login)
 *     description: Hanya bisa didownload jika sudah disetujui (isApproved=true).
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: File PDF karya ilmiah
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       403:
 *         description: Karya ilmiah belum disetujui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id/download", auth, c.download);

module.exports = router;
