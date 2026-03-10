// src/controllers/fakultas.controller.js
const { prisma } = require("../utils/prisma");
const { ok, fail, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

const inc = { prodi: { where: { isActive: true }, orderBy: { nama: "asc" } } };

exports.getAll = async (req, res) => {
  try {
    const { withInactive } = req.query;
    const isAdmin = ["pustakawan_universitas","pustakawan_fakultas"].includes(req.user?.role);
    const where   = (isAdmin && withInactive === "true") ? {} : { isActive: true };
    const data    = await prisma.fakultas.findMany({ where, include: inc, orderBy: { nama: "asc" } });
    return ok(res, data);
  } catch (err) { return catchError(res, err, "fakultas.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const f = await prisma.fakultas.findUnique({ where: { id: +req.params.id }, include: inc });
    if (!f) return fail(res, "Fakultas tidak ditemukan.", 404);
    return ok(res, f);
  } catch (err) { return catchError(res, err, "fakultas.getOne"); }
};

exports.create = async (req, res) => {
  try {
    const { nama, kode, warna } = req.body;
    const f = await prisma.fakultas.create({
      data: { nama: nama.trim(), kode: kode.toUpperCase().trim(), warna: warna || "#6366f1" },
      include: inc,
    });
    await addLog(req.user.id, "Tambah Fakultas", `Menambahkan: ${nama}`, "🏛️", "#6366f1", req.ip);
    return ok(res, f, "Fakultas berhasil ditambahkan.", 201);
  } catch (err) { return catchError(res, err, "fakultas.create"); }
};

exports.update = async (req, res) => {
  try {
    const exists = await prisma.fakultas.findUnique({ where: { id: +req.params.id } });
    if (!exists) return fail(res, "Fakultas tidak ditemukan.", 404);
    const { nama, kode, warna, isActive } = req.body;
    const f = await prisma.fakultas.update({
      where: { id: +req.params.id },
      include: inc,
      data: {
        ...(nama     !== undefined && { nama: nama.trim()                }),
        ...(kode     !== undefined && { kode: kode.toUpperCase().trim()  }),
        ...(warna    !== undefined && { warna                            }),
        ...(isActive !== undefined && { isActive                         }),
      },
    });
    await addLog(req.user.id, "Edit Fakultas", `Mengubah: ${f.nama}`, "✏️", "#f59e0b", req.ip);
    return ok(res, f, "Fakultas berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "fakultas.update"); }
};

exports.remove = async (req, res) => {
  try {
    const f = await prisma.fakultas.findUnique({ where: { id: +req.params.id } });
    if (!f) return fail(res, "Fakultas tidak ditemukan.", 404);
    const userCount = await prisma.user.count({ where: { fakultasId: +req.params.id, isActive: true } });
    if (userCount > 0)
      return fail(res, `Tidak dapat menghapus. Masih ada ${userCount} anggota aktif di fakultas ini.`);
    await prisma.fakultas.update({ where: { id: +req.params.id }, data: { isActive: false } });
    await addLog(req.user.id, "Hapus Fakultas", `Menonaktifkan: ${f.nama}`, "🗑️", "#ef4444", req.ip);
    return ok(res, {}, "Fakultas berhasil dinonaktifkan.");
  } catch (err) { return catchError(res, err, "fakultas.remove"); }
};

// ─── Prodi ────────────────────────────────────────────────────────────────────
exports.addProdi = async (req, res) => {
  try {
    const fak = await prisma.fakultas.findUnique({ where: { id: +req.params.id } });
    if (!fak) return fail(res, "Fakultas tidak ditemukan.", 404);
    const { nama, kode, jenjang } = req.body;
    const p = await prisma.prodi.create({
      data: { nama: nama.trim(), kode: kode.toUpperCase().trim(), jenjang: jenjang || "S1", fakultasId: +req.params.id },
    });
    await addLog(req.user.id, "Tambah Prodi", `${nama} di ${fak.nama}`, "📖", "#10b981", req.ip);
    return ok(res, p, "Program studi berhasil ditambahkan.", 201);
  } catch (err) { return catchError(res, err, "fakultas.addProdi"); }
};

exports.updateProdi = async (req, res) => {
  try {
    const p = await prisma.prodi.findUnique({ where: { id: +req.params.prodiId } });
    if (!p) return fail(res, "Program studi tidak ditemukan.", 404);
    const { nama, kode, jenjang, isActive } = req.body;
    const updated = await prisma.prodi.update({
      where: { id: +req.params.prodiId },
      data: {
        ...(nama     !== undefined && { nama: nama.trim()               }),
        ...(kode     !== undefined && { kode: kode.toUpperCase().trim() }),
        ...(jenjang  !== undefined && { jenjang                         }),
        ...(isActive !== undefined && { isActive                        }),
      },
    });
    return ok(res, updated, "Program studi berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "fakultas.updateProdi"); }
};

exports.removeProdi = async (req, res) => {
  try {
    const p = await prisma.prodi.findUnique({ where: { id: +req.params.prodiId } });
    if (!p) return fail(res, "Program studi tidak ditemukan.", 404);
    const userCount = await prisma.user.count({ where: { prodiId: +req.params.prodiId, isActive: true } });
    if (userCount > 0)
      return fail(res, `Tidak dapat menghapus. Masih ada ${userCount} anggota aktif di prodi ini.`);
    await prisma.prodi.update({ where: { id: +req.params.prodiId }, data: { isActive: false } });
    await addLog(req.user.id, "Hapus Prodi", `Menonaktifkan: ${p.nama}`, "🗑️", "#ef4444", req.ip);
    return ok(res, {}, "Program studi berhasil dinonaktifkan.");
  } catch (err) { return catchError(res, err, "fakultas.removeProdi"); }
};
