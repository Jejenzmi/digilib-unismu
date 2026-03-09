// tests/setup/globalTeardown.js
// Dijalankan SEKALI setelah seluruh test suite selesai.
// Tugas: pastikan koneksi DB ditutup dan tidak ada proses yang menggantung.

module.exports = async function globalTeardown() {
  // Tutup koneksi Prisma jika masih terbuka
  try {
    const { prisma } = require("../../src/utils/prisma");
    await prisma.$disconnect();
    console.log("\n✅ [Jest] globalTeardown: koneksi DB ditutup");
  } catch {
    // Prisma mungkin belum pernah diinit — abaikan
  }
};
