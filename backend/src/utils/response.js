// src/utils/response.js
const { handlePrismaError } = require("./prisma");
const logger = require("../config/logger");
const { env } = require("../config/env");

const ok = (res, data = {}, message = "Berhasil", status = 200) =>
  res.status(status).json({ success: true, message, requestId: res.locals.requestId, data });

const fail = (res, message = "Gagal", status = 400, errors = null) =>
  res.status(status).json({
    success: false, message, requestId: res.locals.requestId,
    ...(errors && { errors }),
  });

const paginate = (res, data, total, page, limit, message = "Berhasil") =>
  res.json({
    success: true, message, requestId: res.locals.requestId, data,
    pagination: { total, page: +page, limit: +limit, totalPages: Math.ceil(total / +limit) },
  });

const catchError = (res, err, context = "") => {
  const prismaErr = handlePrismaError(err);
  if (prismaErr) {
    logger.warn(`[${context}] Prisma ${err.code}: ${err.message}`, { requestId: res.locals.requestId });
    return fail(res, prismaErr.message, prismaErr.status);
  }
  logger.error(`[${context}] ${err.message}`, { stack: err.stack, requestId: res.locals.requestId });
  return fail(res, env.isProd ? "Terjadi kesalahan pada server. Silakan coba lagi." : err.message, 500);
};

module.exports = { ok, fail, paginate, catchError };
