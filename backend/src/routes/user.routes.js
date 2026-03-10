// src/routes/user.routes.js
const router   = require("express").Router();
const c        = require("../controllers/user.controller");
const { auth, adminOnly, adminOrFakultasAdmin, kepalaOnly } = require("../middleware/auth.middleware");
const { uploadAvatar, validateImageMagic } = require("../middleware/upload.middleware");
const validate = require("../middleware/validate.middleware");
const { createUserRules, updateUserRules, resetPasswordRules } = require("../validations/index");

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Daftar semua pengguna (admin)
 *     description: Hanya dapat diakses oleh Kepala atau Pustakawan.
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [kepala, pustakawan, mahasiswa, umum] }
 *         description: Filter berdasarkan role
 *       - in: query
 *         name: fakultasId
 *         schema: { type: integer }
 *         description: Filter berdasarkan fakultas
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter aktif/nonaktif
 *     responses:
 *       200:
 *         description: Daftar pengguna berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/", auth, adminOnly, c.getAll);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Detail satu pengguna
 *     description: User biasa hanya bisa melihat data sendiri. Admin bisa melihat semua.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Data pengguna berhasil diambil
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get("/:id", auth, c.getOne);

/**
 * @swagger
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Tambah anggota baru (admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Anggota berhasil didaftarkan
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: NIM atau email sudah digunakan
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post("/", auth, adminOnly, createUserRules, validate, c.create);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Perbarui data pengguna
 *     description: User biasa hanya bisa update data sendiri (name, email, phone, alamat). Admin bisa update semua field termasuk isActive.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:       { type: string }
 *               email:      { type: string, format: email }
 *               phone:      { type: string }
 *               alamat:     { type: string }
 *               angkatan:   { type: string }
 *               isActive:   { type: boolean, description: "Hanya admin" }
 *               isVerified: { type: boolean, description: "Hanya admin" }
 *     responses:
 *       200:
 *         description: Data berhasil diperbarui
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put("/:id", auth, updateUserRules, validate, c.update);

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   put:
 *     tags: [Users]
 *     summary: Upload avatar pengguna
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [avatar]
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File gambar (JPG/PNG/WebP, maks 3MB)
 *     responses:
 *       200:
 *         description: Avatar berhasil diperbarui
 */
router.put("/:id/avatar", auth, uploadAvatar.single("avatar"), validateImageMagic, c.updateAvatar);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Nonaktifkan pengguna (soft delete, khusus Kepala)
 *     description: Akun dinonaktifkan (isActive=false), data tidak dihapus dari database.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Pengguna berhasil dinonaktifkan
 *       400:
 *         description: Tidak dapat menonaktifkan akun Kepala Perpustakaan
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete("/:id", auth, kepalaOnly, c.remove);

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   put:
 *     tags: [Users]
 *     summary: Reset password pengguna (khusus Kepala)
 *     description: Password direset dan semua sesi aktif user tersebut dihentikan.
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
 *                 example: "NewPass@123"
 *                 description: Min 8 karakter, harus ada huruf besar, kecil, dan angka
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put("/:id/reset-password", auth, kepalaOnly, resetPasswordRules, validate, c.resetPassword);

module.exports = router;
