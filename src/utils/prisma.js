// src/utils/prisma.js
const { PrismaClient, Prisma } = require("@prisma/client");
const logger = require("../config/logger");
const { env } = require("../config/env");

const prisma = global.__prisma || new PrismaClient({
  log: env.isDev
    ? [{ emit: "event", level: "error" }, { emit: "event", level: "warn" }]
    : [{ emit: "event", level: "error" }],
});

if (!env.isProd && !env.isTest) global.__prisma = prisma;

prisma.$on("error", e => logger.error("Prisma error:", { message: e.message }));
prisma.$on("warn",  e => logger.warn("Prisma warning:", { message: e.message }));

// ─── Terjemahkan Prisma error ke pesan bahasa Indonesia ──────────────────────
function handlePrismaError(err) {
  // Known request errors (P-codes)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const field = Array.isArray(err.meta?.target) ? err.meta.target[0] : "data";
        const label = { nim: "NIM", email: "Email", isbn: "ISBN", kode: "Kode" }[field] || field;
        return { status: 409, message: `${label} sudah digunakan. Gunakan nilai yang berbeda.` };
      }
      case "P2025": return { status: 404, message: "Data tidak ditemukan." };
      case "P2003": return { status: 400, message: "Relasi data tidak valid. Pastikan data terkait sudah ada." };
      case "P2014": return { status: 400, message: "Relasi data tidak konsisten." };
      case "P2021": return { status: 500, message: "Tabel database tidak ditemukan. Jalankan prisma migrate." };
      default:      return { status: 500, message: `Database error (${err.code}).` };
    }
  }

  // Unknown request errors — termasuk MySQL CHECK constraint violations.
  // Prisma melempar PrismaClientUnknownRequestError untuk error MySQL yang
  // tidak dipetakan ke Prisma error code, seperti:
  //   "Check constraint `chk_stok_non_negative` was violated" (MySQL 3819)
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = err.message || "";
    // MySQL error 3819: CHECK constraint violated
    if (msg.includes("3819") || msg.toLowerCase().includes("check constraint")) {
      if (msg.includes("stok")) return { status: 400, message: "Stok buku tidak boleh negatif." };
      return { status: 400, message: "Data melanggar constraint database." };
    }
    // MySQL error 1213: Deadlock — minta client retry
    if (msg.includes("1213") || msg.toLowerCase().includes("deadlock"))
      return { status: 409, message: "Konflik data bersamaan. Silakan coba lagi." };
    logger.error("PrismaClientUnknownRequestError:", { message: msg });
    return { status: 500, message: "Database error tidak dikenal." };
  }

  if (err instanceof Prisma.PrismaClientValidationError)
    return { status: 400, message: "Format data tidak valid." };
  if (err instanceof Prisma.PrismaClientInitializationError)
    return { status: 503, message: "Koneksi database gagal. Coba beberapa saat lagi." };

  return null;
}

module.exports = { prisma, handlePrismaError, Prisma };
