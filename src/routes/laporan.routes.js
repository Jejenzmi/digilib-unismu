// src/routes/laporan.routes.js
const router   = require("express").Router();
const c        = require("../controllers/laporan.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");

/**
 * @swagger
 * /api/laporan/statistik:
 *   get:
 *     tags: [Laporan]
 *     summary: Statistik dashboard utama (admin)
 *     description: |
 *       Mengembalikan ringkasan data untuk dashboard admin:
 *       - Total buku, anggota, peminjaman, skripsi, jurnal
 *       - Status peminjaman (dipinjam / terlambat / dikembalikan)
 *       - 10 buku paling banyak diunduh
 *       - Total denda terkumpul
 *     responses:
 *       200:
 *         description: Statistik berhasil diambil
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
 *                         totalBuku:       { type: integer }
 *                         totalAnggota:    { type: integer }
 *                         totalPeminjaman: { type: integer }
 *                         statusPeminjaman:
 *                           type: object
 *                           properties:
 *                             dipinjam:     { type: integer }
 *                             terlambat:    { type: integer }
 *                             dikembalikan: { type: integer }
 *                         topBuku:   { type: array }
 *                         totalDenda:{ type: integer }
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get("/statistik", auth, adminOnly, c.statistik);

/**
 * @swagger
 * /api/laporan/peminjaman-per-bulan:
 *   get:
 *     tags: [Laporan]
 *     summary: Jumlah peminjaman per bulan dalam satu tahun (admin)
 *     parameters:
 *       - in: query
 *         name: tahun
 *         schema: { type: integer, default: 2024 }
 *         description: Tahun yang ingin dilihat
 *     responses:
 *       200:
 *         description: Data peminjaman per bulan
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
 *                         tahun:    { type: integer }
 *                         perBulan: { type: array, items: { type: integer }, description: "Index 0=Januari, 11=Desember" }
 */
router.get("/peminjaman-per-bulan", auth, adminOnly, c.peminjamanPerBulan);

/**
 * @swagger
 * /api/laporan/anggota-per-fakultas:
 *   get:
 *     tags: [Laporan]
 *     summary: Jumlah anggota aktif per fakultas (admin)
 *     responses:
 *       200:
 *         description: Data anggota per fakultas
 */
router.get("/anggota-per-fakultas", auth, adminOnly, c.anggotaPerFakultas);

/**
 * @swagger
 * /api/laporan/export/buku:
 *   get:
 *     tags: [Laporan]
 *     summary: Export koleksi buku ke Excel (.xlsx) (admin)
 *     description: Mendownload file Excel berisi seluruh koleksi buku aktif.
 *     responses:
 *       200:
 *         description: File Excel koleksi buku
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/buku",       auth, adminOnly, c.exportBuku);

/**
 * @swagger
 * /api/laporan/export/peminjaman:
 *   get:
 *     tags: [Laporan]
 *     summary: Export data peminjaman ke Excel (.xlsx) (admin)
 *     responses:
 *       200:
 *         description: File Excel data peminjaman
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/peminjaman", auth, adminOnly, c.exportPeminjaman);

/**
 * @swagger
 * /api/laporan/export/anggota:
 *   get:
 *     tags: [Laporan]
 *     summary: Export data anggota ke Excel (.xlsx) (admin)
 *     responses:
 *       200:
 *         description: File Excel data anggota
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get("/export/anggota",    auth, adminOnly, c.exportAnggota);

module.exports = router;
