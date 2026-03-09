// src/controllers/jurnal.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");
const clamp = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=20, search, isActive } = req.query;
    const where = {
      ...(isActive !== undefined && { isActive: isActive === "true" }),
      ...(search && { OR: [
        { title:    { contains: search } },
        { penerbit: { contains: search } },
        { editor:   { contains: search } },
      ]}),
    };
    const [data, total] = await Promise.all([
      prisma.jurnal.findMany({ where,
        skip: (clamp(page,1,1000)-1)*clamp(limit,1,50), take: clamp(limit,1,50),
        orderBy: { year: "desc" } }),
      prisma.jurnal.count({ where }),
    ]);
    return paginate(res, data, total, page, limit);
  } catch (err) { return catchError(res, err, "jurnal.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const j = await prisma.jurnal.findUnique({ where: { id: +req.params.id } });
    if (!j) return fail(res, "Jurnal tidak ditemukan.", 404);
    return ok(res, j);
  } catch (err) { return catchError(res, err, "jurnal.getOne"); }
};

exports.create = async (req, res) => {
  try {
    const { title, issn, issnE, volume, year, articles, editor, penerbit, frekuensi, warna, isActive } = req.body;
    if (!title?.trim()) return fail(res, "Judul jurnal wajib diisi.");
    const j = await prisma.jurnal.create({
      data: {
        title: title.trim(),
        issn:     issn     || null,
        issnE:    issnE    || null,
        volume:   volume   || null,
        year:     +year    || new Date().getFullYear(),
        articles: +articles || 0,
        editor:   editor   || null,
        penerbit: penerbit || null,
        frekuensi:frekuensi|| null,
        warna:    warna    || "#6366f1",
        isActive: isActive !== false,
      },
    });
    await addLog(req.user.id, "Tambah Jurnal", `Menambahkan: ${title}`, "📰", "#6366f1", req.ip);
    return ok(res, j, "Jurnal berhasil ditambahkan.", 201);
  } catch (err) { return catchError(res, err, "jurnal.create"); }
};

exports.update = async (req, res) => {
  try {
    const j = await prisma.jurnal.findUnique({ where: { id: +req.params.id } });
    if (!j) return fail(res, "Jurnal tidak ditemukan.", 404);
    // Hanya ambil field yang dikenal — jangan spread req.body langsung ke Prisma
    const { title, issn, issnE, volume, year, articles, editor, penerbit, frekuensi, warna, isActive } = req.body;
    const updated = await prisma.jurnal.update({
      where: { id: +req.params.id },
      data: {
        ...(title     !== undefined && { title:    title.trim()  }),
        ...(issn      !== undefined && { issn:     issn||null    }),
        ...(issnE     !== undefined && { issnE:    issnE||null   }),
        ...(volume    !== undefined && { volume:   volume||null  }),
        ...(year      !== undefined && { year:     +year         }),
        ...(articles  !== undefined && { articles: +articles     }),
        ...(editor    !== undefined && { editor:   editor||null  }),
        ...(penerbit  !== undefined && { penerbit: penerbit||null}),
        ...(frekuensi !== undefined && { frekuensi:frekuensi||null}),
        ...(warna     !== undefined && { warna                   }),
        ...(isActive  !== undefined && { isActive                }),
      },
    });
    await addLog(req.user.id, "Edit Jurnal", `Mengubah: ${updated.title}`, "✏️", "#f59e0b", req.ip);
    return ok(res, updated, "Jurnal berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "jurnal.update"); }
};

exports.remove = async (req, res) => {
  try {
    const j = await prisma.jurnal.findUnique({ where: { id: +req.params.id } });
    if (!j) return fail(res, "Jurnal tidak ditemukan.", 404);
    await prisma.jurnal.delete({ where: { id: +req.params.id } });
    await addLog(req.user.id, "Hapus Jurnal", `Menghapus: ${j.title}`, "🗑️", "#ef4444", req.ip);
    return ok(res, {}, "Jurnal berhasil dihapus.");
  } catch (err) { return catchError(res, err, "jurnal.remove"); }
};
