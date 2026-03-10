// src/controllers/auth.controller.js
const bcrypt       = require("bcryptjs");
const { prisma }   = require("../utils/prisma");
const { signAccess, signRefresh, verifyRefresh } = require("../utils/token");
const { env } = require("../config/env");
const { ok, fail, catchError } = require("../utils/response");
const { addLog }   = require("../middleware/log.middleware");
const emailSvc     = require("../utils/email");

const safeUser = (u) => { const { password, refreshTokens, ...r } = u; return r; };

// Helper: parse durasi JWT (e.g. "7d", "30d", "24h") → milliseconds
function parseDuration(str) {
  const n = parseInt(str);
  if (str.endsWith("d")) return n * 864e5;
  if (str.endsWith("h")) return n * 36e5;
  if (str.endsWith("m")) return n * 6e4;
  return 7 * 864e5; // fallback 7 hari
}

exports.login = async (req, res) => {
  try {
    const { nim, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { nim: nim.trim() },
      include: { fakultas: true, prodi: true },
    });
    // Pesan identik untuk semua kasus — cegah user enumeration
    if (!user || !(await bcrypt.compare(password, user.password)))
      return fail(res, "NIM atau password salah.", 401);
    if (!user.isActive)
      return fail(res, "Akun Anda dinonaktifkan. Silakan hubungi perpustakaan.", 403);

    const payload      = { id: user.id, nim: user.nim, role: user.role };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await prisma.$transaction([
      prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id,
                expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn)),
                userAgent: req.headers["user-agent"]?.slice(0, 300) || null,
                ipAddress: req.ip },
      }),
      prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }),
    ]);

    await addLog(user.id, "Login", `Masuk sebagai ${user.role}`, "🔐", "#6366f1", req.ip);
    return ok(res, { accessToken, refreshToken, user: safeUser(user) }, "Login berhasil");
  } catch (err) { return catchError(res, err, "auth.login"); }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return fail(res, "Refresh token tidak ditemukan.", 401);

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored)                      return fail(res, "Refresh token tidak valid.", 401);
    if (new Date() > stored.expiresAt) {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      return fail(res, "Refresh token kedaluwarsa. Silakan login ulang.", 401);
    }

    let decoded;
    try { decoded = verifyRefresh(refreshToken); }
    catch {
      await prisma.refreshToken.delete({ where: { token: refreshToken } });
      return fail(res, "Refresh token tidak valid.", 401);
    }

    const newAccess  = signAccess({ id: decoded.id, nim: decoded.nim, role: decoded.role });
    const newRefresh = signRefresh({ id: decoded.id, nim: decoded.nim, role: decoded.role });

    // Rotate — hapus lama, buat baru (atomic)
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: { token: newRefresh, userId: decoded.id,
                expiresAt: new Date(Date.now() + parseDuration(env.jwtRefreshExpiresIn)),
                userAgent: req.headers["user-agent"]?.slice(0, 300) || null,
                ipAddress: req.ip },
      }),
    ]);

    return ok(res, { accessToken: newAccess, refreshToken: newRefresh }, "Token diperbarui");
  } catch (err) { return catchError(res, err, "auth.refresh"); }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    await addLog(req.user?.id, "Logout", "Keluar dari sistem", "🚪", "#ef4444", req.ip);
    return ok(res, {}, "Logout berhasil");
  } catch (err) { return catchError(res, err, "auth.logout"); }
};

exports.me = async (req, res) => ok(res, safeUser(req.user));

exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(oldPassword, user.password)))
      return fail(res, "Password lama salah.", 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    // Invalidate SEMUA sesi aktif saat password diganti
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id },
        data: { password: hashed, passwordChangedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);
    await addLog(user.id, "Ganti Password", "Mengubah password akun", "🔑", "#f59e0b", req.ip);
    return ok(res, {}, "Password berhasil diubah. Silakan login ulang dengan password baru.");
  } catch (err) { return catchError(res, err, "auth.changePassword"); }
};
