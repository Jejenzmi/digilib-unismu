// src/middleware/error.middleware.js
const logger             = require("../config/logger");
const { handlePrismaError } = require("../utils/prisma");
const { env }            = require("../config/env");

const notFound = (req, res) =>
  res.status(404).json({
    success:   false,
    message:   `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`,
    requestId: res.locals.requestId,
  });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const rid = res.locals.requestId;

  // Multer
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ success: false, requestId: rid,
      message: `File terlalu besar. Maksimal ${env.maxFileSizeMb}MB.` });
  if (err.code === "LIMIT_UNEXPECTED_FILE")
    return res.status(400).json({ success: false, requestId: rid, message: "Field file tidak dikenal." });
  if (err.message?.startsWith("Hanya file"))
    return res.status(400).json({ success: false, requestId: rid, message: err.message });

  // Prisma
  const prismaErr = handlePrismaError(err);
  if (prismaErr) {
    logger.warn(`[${rid}] Prisma ${err.code}: ${err.message}`);
    return res.status(prismaErr.status).json({ success: false, requestId: rid, message: prismaErr.message });
  }

  // JWT
  if (err.name === "JsonWebTokenError")
    return res.status(401).json({ success: false, requestId: rid, message: "Token tidak valid." });
  if (err.name === "TokenExpiredError")
    return res.status(401).json({ success: false, requestId: rid, message: "Sesi berakhir. Silakan login ulang." });

  // CORS
  if (err.message?.includes("tidak diizinkan oleh CORS"))
    return res.status(403).json({ success: false, requestId: rid, message: err.message });

  const status = err.status || err.statusCode || 500;
  logger.error(`[${rid}] ${req.method} ${req.path} → ${status}: ${err.message}`, {
    stack: err.stack, user: req.user?.id,
  });

  res.status(status).json({
    success:   false,
    requestId: rid,
    message:   env.isProd
      ? "Terjadi kesalahan pada server. Silakan coba lagi."
      : err.message,
    ...(env.isDev && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
