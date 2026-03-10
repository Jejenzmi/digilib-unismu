// src/jobs/cron.jobs.js
const { env } = require("../config/env");

// ── Jika test environment, ekspor fungsi kosong ───────────────────────────────
// Cron TIDAK boleh jalan saat test karena akan interfere dengan hasil test
// dan memperlambat test suite.
if (env.isTest) {
  module.exports = {
    startCronJobs:  () => {},
    runStartupJobs: async () => {},
  };
  return; // Node.js mengizinkan early return di CommonJS module
}

const cron   = require("node-cron");
const { prisma } = require("../utils/prisma");
const logger = require("../config/logger");

// ─── Job 1: Update status terlambat ──────────────────────────────────────────
async function updateStatusTerlambat() {
  try {
    const { count } = await prisma.peminjaman.updateMany({
      where: { status: "dipinjam", tanggalKembali: { lt: new Date() } },
      data:  { status: "terlambat" },
    });
    if (count > 0) logger.info(`[CRON] ${count} peminjaman → status terlambat`);
  } catch (err) { logger.error(`[CRON] updateStatusTerlambat: ${err.message}`); }
}

// ─── Job 2: Hitung & perbarui denda real-time ─────────────────────────────────
async function hitungDenda() {
  try {
    const setting      = await prisma.setting.findUnique({ where: { key: "denda_per_hari" } });
    const dendaPerHari = parseInt(setting?.value || "1000");

    // Satu query UPDATE bulk via raw SQL — menggantikan loop N+1 yang sebelumnya
    // menjalankan 1 UPDATE per peminjaman terlambat (sangat lambat di scale).
    // DATEDIFF(NOW(), tanggalKembali) = jumlah hari sejak jatuh tempo
    const result = await prisma.$executeRaw`
      UPDATE peminjaman
      SET denda = GREATEST(0, DATEDIFF(NOW(), tanggalKembali)) * ${dendaPerHari}
      WHERE status = 'terlambat'
        AND dendaDibayar = FALSE
        AND denda != GREATEST(0, DATEDIFF(NOW(), tanggalKembali)) * ${dendaPerHari}
    `;
    if (result > 0) logger.info(`[CRON] Denda diperbarui: ${result} peminjaman`);
  } catch (err) { logger.error(`[CRON] hitungDenda: ${err.message}`); }
}

// ─── Job 3: Bersihkan refresh token expired ───────────────────────────────────
async function cleanExpiredTokens() {
  try {
    const { count } = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (count > 0) logger.info(`[CRON] ${count} refresh token expired dihapus`);
  } catch (err) { logger.error(`[CRON] cleanExpiredTokens: ${err.message}`); }
}

// ─── Job 4: Bersihkan activity log lama ───────────────────────────────────────
async function cleanOldLogs() {
  try {
    const cutoff = new Date(Date.now() - 90 * 864e5);
    const { count } = await prisma.activityLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) logger.info(`[CRON] ${count} activity log lama dihapus`);
  } catch (err) { logger.error(`[CRON] cleanOldLogs: ${err.message}`); }
}

// ─── Register cron jobs ───────────────────────────────────────────────────────
function startCronJobs() {
  // Setiap hari jam 00:01 WIB — update terlambat + hitung denda
  cron.schedule("1 0 * * *", async () => {
    logger.info("[CRON] Menjalankan job harian...");
    await updateStatusTerlambat();
    await hitungDenda();
  }, { timezone: "Asia/Jakarta" });

  // Setiap hari jam 03:00 WIB — bersihkan log lama
  cron.schedule("0 3 * * *", cleanOldLogs, { timezone: "Asia/Jakarta" });

  // Setiap Minggu jam 02:00 WIB — bersihkan refresh token expired
  cron.schedule("0 2 * * 0", cleanExpiredTokens, { timezone: "Asia/Jakarta" });

  logger.info("⏰ Cron jobs aktif (Asia/Jakarta)");
}

// Jalankan sekali saat startup — catch-up jika server sempat mati/restart
async function runStartupJobs() {
  logger.info("[STARTUP] Catch-up jobs...");
  await updateStatusTerlambat();
  await hitungDenda();
  await cleanExpiredTokens();
}

module.exports = { startCronJobs, runStartupJobs };
