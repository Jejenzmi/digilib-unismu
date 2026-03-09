// src/controllers/book.controller.js
const path   = require("path");
const fs     = require("fs");
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

const clamp = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=20, category, search, badge, sort="createdAt" } = req.query;
    const skip  = (clamp(page,1,1000)-1) * clamp(limit,1,50);
    const take  = clamp(limit,1,50);
    const where = {
      isActive: true,
      ...(category && category !== "Semua" && { category }),
      ...(badge    && { badge }),
      ...(search   && { OR: [
        { title:  { contains: search } },
        { author: { contains: search } },
        { isbn:   { contains: search } },
      ]}),
    };
    const orderBy = sort==="downloads" ? {downloads:"desc"} : sort==="rating" ? {rating:"desc"} : {createdAt:"desc"};
    const [data, total] = await Promise.all([
      prisma.book.findMany({ where, skip, take, orderBy }),
      prisma.book.count({ where }),
    ]);
    return paginate(res, data, total, page, limit);
  } catch (err) { return catchError(res, err, "book.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const book = await prisma.book.findUnique({ where: { id: +req.params.id } });
    if (!book || !book.isActive) return fail(res, "Buku tidak ditemukan.", 404);
    return ok(res, book);
  } catch (err) { return catchError(res, err, "book.getOne"); }
};

exports.create = async (req, res) => {
  try {
    const { title, author, year, category, isbn, pages, stok, lokasi, abstract, badge, coverColor1, coverColor2 } = req.body;
    const book = await prisma.book.create({
      data: {
        title, author, year: +year, category,
        isbn: isbn||null, pages: +pages||0, stok: +stok||1,
        lokasi: lokasi||null, abstract: abstract||null,
        badge: badge||null, coverColor1: coverColor1||"#6366f1", coverColor2: coverColor2||"#8b5cf6",
        filePath: req.file ? `/uploads/books/${req.file.filename}` : null,
      },
    });
    await addLog(req.user.id, "Tambah Buku", `Menambahkan: ${title}`, "📚", "#6366f1", req.ip);
    return ok(res, book, "Buku berhasil ditambahkan.", 201);
  } catch (err) { return catchError(res, err, "book.create"); }
};

exports.update = async (req, res) => {
  try {
    const existing = await prisma.book.findUnique({ where: { id: +req.params.id } });
    if (!existing) return fail(res, "Buku tidak ditemukan.", 404);
    if (req.file && existing.filePath) {
      const old = path.join(process.cwd(), existing.filePath);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    const { title, author, year, category, isbn, pages, stok, lokasi, abstract, badge, coverColor1, coverColor2, isActive } = req.body;
    const book = await prisma.book.update({
      where: { id: +req.params.id },
      data: {
        ...(title       !== undefined && { title }),
        ...(author      !== undefined && { author }),
        ...(year        !== undefined && { year: +year }),
        ...(category    !== undefined && { category }),
        ...(isbn        !== undefined && { isbn: isbn||null }),
        ...(pages       !== undefined && { pages: +pages }),
        ...(stok        !== undefined && { stok: +stok }),
        ...(lokasi      !== undefined && { lokasi: lokasi||null }),
        ...(abstract    !== undefined && { abstract: abstract||null }),
        ...(badge       !== undefined && { badge: badge||null }),
        ...(coverColor1 !== undefined && { coverColor1 }),
        ...(coverColor2 !== undefined && { coverColor2 }),
        ...(isActive    !== undefined && { isActive }),
        ...(req.file    && { filePath: `/uploads/books/${req.file.filename}` }),
      },
    });
    await addLog(req.user.id, "Edit Buku", `Mengubah: ${book.title}`, "✏️", "#f59e0b", req.ip);
    return ok(res, book, "Buku berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "book.update"); }
};

exports.remove = async (req, res) => {
  try {
    const book = await prisma.book.findUnique({ where: { id: +req.params.id } });
    if (!book) return fail(res, "Buku tidak ditemukan.", 404);
    const dipinjam = await prisma.peminjaman.count({
      where: { bookId: +req.params.id, status: { in: ["dipinjam","terlambat"] } },
    });
    if (dipinjam > 0) return fail(res, `Buku tidak dapat dihapus, masih dipinjam oleh ${dipinjam} anggota.`);
    await prisma.book.update({ where: { id: +req.params.id }, data: { isActive: false } });
    await addLog(req.user.id, "Hapus Buku", `Menghapus: ${book.title}`, "🗑️", "#ef4444", req.ip);
    return ok(res, {}, "Buku berhasil dihapus.");
  } catch (err) { return catchError(res, err, "book.remove"); }
};

exports.download = async (req, res) => {
  try {
    const book = await prisma.book.findUnique({ where: { id: +req.params.id } });
    if (!book || !book.isActive) return fail(res, "Buku tidak ditemukan.", 404);
    if (!book.filePath)          return fail(res, "File PDF belum tersedia untuk buku ini.", 404);
    const fp = path.join(process.cwd(), book.filePath);
    if (!fs.existsSync(fp))      return fail(res, "File tidak ditemukan di server.", 404);

    // Increment downloads dan tulis log SETELAH seluruh file berhasil dikirim.
    // Jika increment dilakukan sebelum res.download dan transfer gagal di tengah
    // jalan (koneksi putus, disk error), counter tetap naik padahal file tidak diterima.
    res.on("finish", () => {
      // Fire-and-forget — jangan biarkan error di sini crash response yang sudah selesai
      prisma.book.update({ where: { id: book.id }, data: { downloads: { increment: 1 } } })
        .then(() => addLog(req.user.id, "Unduh Buku", `Mengunduh: ${book.title}`, "⬇️", "#10b981", req.ip))
        .catch(e => {
          const logger = require("../config/logger");
          logger.error("book.download — gagal update counter:", { message: e.message });
        });
    });

    res.download(fp, `${book.title}.pdf`);
  } catch (err) { return catchError(res, err, "book.download"); }
};
