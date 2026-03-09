// src/controllers/skripsi.controller.js
const path   = require("path");
const fs     = require("fs");
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

const inc   = { prodi: { include: { fakultas: true } }, uploadedBy: { select: { id:true, name:true, nim:true } } };
const clamp = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=20, prodiId, search, isApproved } = req.query;
    const where = {
      ...(prodiId    && { prodiId: +prodiId }),
      ...(isApproved !== undefined && { isApproved: isApproved === "true" }),
      ...(search && { OR: [
        { title:      { contains: search } },
        { authorName: { contains: search } },
        { nim:        { contains: search } },
      ]}),
    };
    const [data, total] = await Promise.all([
      prisma.skripsi.findMany({ where,
        skip: (clamp(page,1,1000)-1)*clamp(limit,1,50), take: clamp(limit,1,50),
        include: inc, orderBy: { createdAt: "desc" } }),
      prisma.skripsi.count({ where }),
    ]);
    return paginate(res, data, total, page, limit);
  } catch (err) { return catchError(res, err, "skripsi.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const s = await prisma.skripsi.findUnique({ where: { id: +req.params.id }, include: inc });
    if (!s) return fail(res, "Skripsi tidak ditemukan.", 404);
    return ok(res, s);
  } catch (err) { return catchError(res, err, "skripsi.getOne"); }
};

exports.create = async (req, res) => {
  try {
    const { title, authorName, nim, tahun, abstrak, pembimbing, prodiId } = req.body;
    if (!title || !authorName) return fail(res, "Judul dan nama penulis wajib diisi.");
    const isAdmin  = ["kepala","pustakawan"].includes(req.user.role);
    const filePath = req.file ? `/uploads/skripsi/${req.file.filename}` : null;
    const s = await prisma.skripsi.create({
      data: {
        title, authorName,
        nim:          nim || req.user.nim,
        tahun:        +tahun || new Date().getFullYear(),
        abstrak:      abstrak || null,
        pembimbing:   pembimbing || null,
        filePath,
        prodiId:      prodiId ? +prodiId : null,
        uploadedById: req.user.id,
        isApproved:   isAdmin,   // admin langsung approve, mahasiswa menunggu
      },
    });
    await addLog(req.user.id, "Upload Skripsi", `Mengunggah: ${title}`, "📄", "#3b82f6", req.ip);
    return ok(res, s,
      isAdmin ? "Skripsi berhasil ditambahkan." : "Skripsi dikirim dan menunggu persetujuan admin.",
      201);
  } catch (err) { return catchError(res, err, "skripsi.create"); }
};

exports.approve = async (req, res) => {
  try {
    const s = await prisma.skripsi.findUnique({ where: { id: +req.params.id } });
    if (!s) return fail(res, "Skripsi tidak ditemukan.", 404);
    if (s.isApproved) return fail(res, "Skripsi sudah disetujui sebelumnya.");
    const updated = await prisma.skripsi.update({ where: { id: +req.params.id }, data: { isApproved: true } });
    await addLog(req.user.id, "Setujui Skripsi", `Menyetujui: ${s.title}`, "✅", "#10b981", req.ip);
    return ok(res, updated, "Skripsi disetujui dan sekarang tampil di repositori.");
  } catch (err) { return catchError(res, err, "skripsi.approve"); }
};

exports.remove = async (req, res) => {
  try {
    const s = await prisma.skripsi.findUnique({ where: { id: +req.params.id } });
    if (!s) return fail(res, "Skripsi tidak ditemukan.", 404);
    if (s.filePath) {
      const fp = path.join(process.cwd(), s.filePath);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await prisma.skripsi.delete({ where: { id: +req.params.id } });
    await addLog(req.user.id, "Hapus Skripsi", `Menghapus: ${s.title}`, "🗑️", "#ef4444", req.ip);
    return ok(res, {}, "Skripsi berhasil dihapus.");
  } catch (err) { return catchError(res, err, "skripsi.remove"); }
};

exports.download = async (req, res) => {
  try {
    const s = await prisma.skripsi.findUnique({ where: { id: +req.params.id } });
    if (!s)            return fail(res, "Skripsi tidak ditemukan.", 404);
    if (!s.isApproved) return fail(res, "Skripsi belum disetujui.", 403);
    if (!s.filePath)   return fail(res, "File belum tersedia.", 404);
    const fp = path.join(process.cwd(), s.filePath);
    if (!fs.existsSync(fp)) return fail(res, "File tidak ditemukan di server.", 404);

    res.on("finish", () => {
      prisma.skripsi.update({ where: { id: s.id }, data: { downloads: { increment: 1 } } })
        .then(() => addLog(req.user.id, "Unduh Skripsi", `Mengunduh: ${s.title}`, "⬇️", "#10b981", req.ip))
        .catch(e => {
          const logger = require("../config/logger");
          logger.error("skripsi.download — gagal update counter:", { message: e.message });
        });
    });

    res.download(fp, `${s.authorName} - ${s.title}.pdf`);
  } catch (err) { return catchError(res, err, "skripsi.download"); }
};
