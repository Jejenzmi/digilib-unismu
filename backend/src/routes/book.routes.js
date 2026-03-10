// src/routes/book.routes.js
const router   = require("express").Router();
const c        = require("../controllers/book.controller");
const { auth, adminOnly, kepalaOnly, optionalAuth } = require("../middleware/auth.middleware");
const { uploadBookWithCover, validatePdfMagic } = require("../middleware/upload.middleware");
const validate = require("../middleware/validate.middleware");
const { createBookRules, updateBookRules } = require("../validations/index");

/**
 * @swagger
 * /api/books:
 *   get:
 *     tags: [Books]
 *     summary: Daftar buku (publik, dengan paginasi)
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter kategori (e.g. "Sains & Teknologi")
 *       - in: query
 *         name: badge
 *         schema: { type: string, enum: [Baru, Populer, Best Seller] }
 *         description: Filter badge
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, downloads, rating], default: createdAt }
 *         description: Urutan hasil
 *     responses:
 *       200:
 *         description: Daftar buku berhasil diambil
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
 *                         $ref: '#/components/schemas/Book'
 */
router.get("/", optionalAuth, c.getAll);

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     tags: [Books]
 *     summary: Detail satu buku
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detail buku
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Book'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", optionalAuth, c.getOne);

/**
 * @swagger
 * /api/books:
 *   post:
 *     tags: [Books]
 *     summary: Tambah buku baru dengan upload PDF (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookRequest'
 *     responses:
 *       201:
 *         description: Buku berhasil ditambahkan
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: ISBN sudah digunakan
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/", auth, adminOnly, uploadBookWithCover, createBookRules, validate, c.create);

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     tags: [Books]
 *     summary: Perbarui data buku (admin)
 *     description: Upload file PDF baru bersifat opsional. Jika diupload, file lama akan dihapus.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:    { type: string }
 *               author:   { type: string }
 *               year:     { type: integer }
 *               stok:     { type: integer }
 *               isActive: { type: boolean }
 *               file:     { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Buku berhasil diperbarui
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put("/:id", auth, adminOnly, uploadBookWithCover, updateBookRules, validate, c.update);

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     tags: [Books]
 *     summary: Hapus buku (soft delete, khusus Kepala)
 *     description: Buku tidak dapat dihapus jika masih ada yang meminjam.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Buku berhasil dihapus
 *       400:
 *         description: Buku masih dipinjam, tidak dapat dihapus
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, kepalaOnly, c.remove);

/**
 * @swagger
 * /api/books/{id}/download:
 *   get:
 *     tags: [Books]
 *     summary: Download file PDF buku (wajib login)
 *     description: Counter download bertambah setiap kali endpoint ini dipanggil.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: File PDF buku
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Buku atau file tidak ditemukan
 */
router.get("/:id/download", auth, c.download);

module.exports = router;
