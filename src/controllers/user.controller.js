// src/controllers/user.controller.js
const bcrypt     = require("bcryptjs");
const { prisma } = require("../utils/prisma");
const { ok, fail, paginate, catchError } = require("../utils/response");
const { addLog } = require("../middleware/log.middleware");

const inc     = { fakultas: true, prodi: true };
const safe    = (u) => { const { password, refreshTokens, ...r } = u; return r; };
const clamp   = (v, min, max) => Math.min(max, Math.max(min, +v));

exports.getAll = async (req, res) => {
  try {
    const { page=1, limit=20, role, search, fakultasId, isActive } = req.query;
    const skip  = (clamp(page,1,1000)-1) * clamp(limit,1,100);
    const take  = clamp(limit,1,100);
    const where = {
      ...(role       && { role }),
      ...(fakultasId && { fakultasId: +fakultasId }),
      ...(isActive !== undefined && { isActive: isActive === "true" }),
      ...(search && { OR: [
        { name:  { contains: search } },
        { nim:   { contains: search } },
        { email: { contains: search } },
      ]}),
    };
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, skip, take, include: inc, orderBy: { joinedAt: "desc" } }),
      prisma.user.count({ where }),
    ]);
    return paginate(res, data.map(safe), total, page, limit);
  } catch (err) { return catchError(res, err, "user.getAll"); }
};

exports.getOne = async (req, res) => {
  try {
    const user    = await prisma.user.findUnique({ where: { id: +req.params.id }, include: inc });
    if (!user)    return fail(res, "Pengguna tidak ditemukan.", 404);
    const isAdmin = ["kepala","pustakawan"].includes(req.user.role);
    if (!isAdmin && req.user.id !== user.id) return fail(res, "Akses ditolak.", 403);
    return ok(res, safe(user));
  } catch (err) { return catchError(res, err, "user.getOne"); }
};

exports.create = async (req, res) => {
  try {
    const { name, nim, password, role, email, phone, angkatan, tipe, fakultasId, prodiId, alamat } = req.body;
    const hashed     = await bcrypt.hash(password, 12);
    const cardExpiry = new Date(Date.now() + 365 * 864e5);
    const user = await prisma.user.create({
      data: {
        name, nim: nim.trim(), password: hashed,
        role: role || "mahasiswa", email: email||null, phone: phone||null,
        angkatan: angkatan||null, tipe: tipe||null, alamat: alamat||null,
        fakultasId: fakultasId ? +fakultasId : null,
        prodiId:    prodiId    ? +prodiId    : null,
        isVerified: true, cardExpiry, passwordChangedAt: new Date(),
      },
      include: inc,
    });
    await addLog(req.user.id, "Tambah Anggota", `Mendaftarkan: ${name}`, "👤", "#10b981", req.ip);
    return ok(res, safe(user), "Anggota berhasil didaftarkan.", 201);
  } catch (err) { return catchError(res, err, "user.create"); }
};

exports.update = async (req, res) => {
  try {
    const id      = +req.params.id;
    const isAdmin = ["kepala","pustakawan"].includes(req.user.role);
    if (!isAdmin && req.user.id !== id) return fail(res, "Akses ditolak.", 403);
    const { name, email, phone, alamat, angkatan, tipe, fakultasId, prodiId, isActive, isVerified } = req.body;
    const updated = await prisma.user.update({
      where: { id }, include: inc,
      data: {
        ...(name       !== undefined && { name }),
        ...(email      !== undefined && { email:    email||null }),
        ...(phone      !== undefined && { phone:    phone||null }),
        ...(alamat     !== undefined && { alamat:   alamat||null }),
        ...(angkatan   !== undefined && { angkatan: angkatan||null }),
        ...(tipe       !== undefined && { tipe:     tipe||null }),
        ...(fakultasId !== undefined && { fakultasId: fakultasId?+fakultasId:null }),
        ...(prodiId    !== undefined && { prodiId:    prodiId?+prodiId:null }),
        ...(isAdmin && isActive   !== undefined && { isActive }),
        ...(isAdmin && isVerified !== undefined && { isVerified }),
      },
    });
    await addLog(req.user.id, "Edit Profil", `Memperbarui: ${updated.name}`, "✏️", "#6366f1", req.ip);
    return ok(res, safe(updated), "Data berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "user.update"); }
};

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) return fail(res, "File avatar tidak ditemukan.");
    const id      = +req.params.id;
    const isAdmin = ["kepala", "pustakawan"].includes(req.user.role);
    // Hanya boleh update avatar milik sendiri, kecuali admin
    if (!isAdmin && req.user.id !== id)
      return fail(res, "Akses ditolak. Anda hanya dapat mengubah avatar sendiri.", 403);
    const updated = await prisma.user.update({
      where: { id },
      data:  { avatar: `/uploads/avatar/${req.file.filename}` },
      include: inc,
    });
    return ok(res, safe(updated), "Avatar berhasil diperbarui.");
  } catch (err) { return catchError(res, err, "user.updateAvatar"); }
};

exports.remove = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: +req.params.id } });
    if (!user)              return fail(res, "Pengguna tidak ditemukan.", 404);
    if (user.role==="kepala") return fail(res, "Akun Kepala Perpustakaan tidak dapat dihapus.");
    await prisma.user.update({ where: { id: +req.params.id }, data: { isActive: false } });
    await addLog(req.user.id, "Nonaktifkan Anggota", `Menonaktifkan: ${user.name}`, "🔒", "#ef4444", req.ip);
    return ok(res, {}, "Pengguna berhasil dinonaktifkan.");
  } catch (err) { return catchError(res, err, "user.remove"); }
};

exports.resetPassword = async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: +req.params.id },
        data: { password: hashed, passwordChangedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: +req.params.id } }),
    ]);
    await addLog(req.user.id, "Reset Password", `Reset password user ID: ${req.params.id}`, "🔑", "#f59e0b", req.ip);
    return ok(res, {}, "Password direset. Semua sesi aktif user telah dihentikan.");
  } catch (err) { return catchError(res, err, "user.resetPassword"); }
};
