// tests/setup/testDb.js
// Helper untuk setup/teardown database di setiap test file.
// Panggil seedTestDb() di beforeAll dan cleanTestDb() di afterAll.

const bcrypt   = require("bcryptjs");
const { prisma } = require("../../src/utils/prisma");

/**
 * Bersihkan database test dalam urutan yang benar (hormati foreign key).
 */
async function cleanTestDb() {
  // Urutan: tabel yang bergantung (child) dihapus dulu
  await prisma.activityLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.peminjaman.deleteMany({});
  await prisma.skripsi.deleteMany({});
  await prisma.jurnal.deleteMany({});
  await prisma.book.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.prodi.deleteMany({});
  await prisma.fakultas.deleteMany({});
  await prisma.setting.deleteMany({});
}

/**
 * Isi data minimum yang dibutuhkan untuk test.
 * Dipanggil setelah cleanTestDb().
 */
async function seedTestDb() {
  await cleanTestDb();

  // Fakultas & Prodi
  const fakTI = await prisma.fakultas.create({ data: { nama:"Teknik Informatika", kode:"FTI", warna:"#6366f1" } });
  const prodiTI = await prisma.prodi.create({ data: { nama:"S1 Teknik Informatika", kode:"TI01", jenjang:"S1", fakultasId: fakTI.id } });

  // Settings minimal
  await prisma.setting.createMany({
    data: [
      { key: "max_pinjam",     value: "3",    label: "Maks Pinjam" },
      { key: "denda_per_hari", value: "1000", label: "Denda/Hari" },
      { key: "durasi_pinjam",  value: "14",   label: "Durasi Default" },
    ],
    skipDuplicates: true,
  });

  const hash = (pw) => bcrypt.hashSync(pw, 10); // rounds rendah untuk kecepatan test

  // Users
  const kepala = await prisma.user.create({ data: {
    name: "Kepala Test", nim: "KP001", password: hash("Admin@UNISMU2024"),
    role: "kepala", email: "kepala@test.ac.id",
    isVerified: true, isActive: true, passwordChangedAt: new Date(),
    cardExpiry: new Date(Date.now() + 365 * 864e5),
  }});

  const pustakawan = await prisma.user.create({ data: {
    name: "Pustakawan Test", nim: "PUS001", password: hash("Pustaka@123"),
    role: "pustakawan", email: "pustakawan@test.ac.id",
    isVerified: true, isActive: true, passwordChangedAt: new Date(),
    cardExpiry: new Date(Date.now() + 365 * 864e5),
  }});

  const mahasiswa = await prisma.user.create({ data: {
    name: "Mahasiswa Test", nim: "2021001001", password: hash("Mahasiswa@123"),
    role: "mahasiswa", email: "mhs@test.ac.id",
    isVerified: true, isActive: true, passwordChangedAt: new Date(),
    cardExpiry: new Date(Date.now() + 365 * 864e5),
    fakultasId: fakTI.id, prodiId: prodiTI.id, angkatan: "2021",
  }});

  const nonaktif = await prisma.user.create({ data: {
    name: "User Nonaktif", nim: "NONAKTIF01", password: hash("Test@1234"),
    role: "mahasiswa", email: "nonaktif@test.ac.id",
    isActive: false, passwordChangedAt: new Date(),
  }});

  // Buku
  const buku1 = await prisma.book.create({ data: {
    title: "Buku Test Alpha", author: "Penulis A", year: 2023,
    category: "Sains & Teknologi", isbn: "978-000-test-001", pages: 200, stok: 5,
    coverColor1: "#6366f1", coverColor2: "#8b5cf6",
  }});

  const buku2 = await prisma.book.create({ data: {
    title: "Buku Test Beta", author: "Penulis B", year: 2022,
    category: "Hukum & Syariah", isbn: "978-000-test-002", pages: 300, stok: 0, // stok habis
    coverColor1: "#10b981", coverColor2: "#059669",
  }});

  const bukuNonaktif = await prisma.book.create({ data: {
    title: "Buku Nonaktif", author: "Penulis C", year: 2021,
    category: "Pendidikan", isbn: "978-000-test-003", pages: 100, stok: 2,
    isActive: false,
    coverColor1: "#ef4444", coverColor2: "#dc2626",
  }});

  return { kepala, pustakawan, mahasiswa, nonaktif, buku1, buku2, bukuNonaktif, fakTI, prodiTI };
}

module.exports = { seedTestDb, cleanTestDb, prisma };
