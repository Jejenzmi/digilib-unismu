// src/middleware/auth.middleware.js
const { verifyAccess } = require("../utils/token");
const { fail }         = require("../utils/response");
const { prisma }       = require("../utils/prisma");

const userInclude = { fakultas: true, prodi: true };

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      return fail(res, "Token tidak ditemukan. Silakan login terlebih dahulu.", 401);

    const token = header.split(" ")[1];
    let decoded;
    try {
      decoded = verifyAccess(token);
    } catch (e) {
      const msg = e.name === "TokenExpiredError"
        ? "Sesi Anda telah berakhir. Silakan login ulang."
        : "Token tidak valid.";
      return fail(res, msg, 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: userInclude });
    if (!user)           return fail(res, "Akun tidak ditemukan.", 401);
    if (!user.isActive)  return fail(res, "Akun Anda dinonaktifkan. Hubungi perpustakaan.", 403);

    req.user = user;
    next();
  } catch (err) {
    return fail(res, "Gagal memverifikasi autentikasi.", 500);
  }
};

const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return fail(res, `Akses ditolak. Fitur ini hanya untuk: ${roles.join(", ")}.`, 403);
  next();
};

const kepalaOnly = role("kepala");
const adminOnly  = role("kepala", "pustakawan");

// Opsional auth — tidak wajib login, tapi user terisi jika ada token valid
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return next();
    const decoded = verifyAccess(header.split(" ")[1]);
    const user    = await prisma.user.findUnique({ where: { id: decoded.id }, include: userInclude });
    if (user?.isActive) req.user = user;
  } catch {}
  next();
};

module.exports = { auth, role, kepalaOnly, adminOnly, optionalAuth };
