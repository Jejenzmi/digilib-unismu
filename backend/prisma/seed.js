// prisma/seed.js
// ─── IDEMPOTENT SEED ──────────────────────────────────────────────────────────
// Aman dijalankan berkali-kali. Semua upsert menggunakan unique key yang stabil.
// Didesain untuk berjalan di docker-compose setiap kali container naik.

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const hash = (pw) => bcrypt.hashSync(pw, 12);

async function upsertSetting(key, value, label = null, group = null) {
  return prisma.setting.upsert({
    where:  { key },
    update: {},
    create: { key, value, label, group },
  });
}

async function main() {
  console.log("🌱 Menjalankan seed Digilib UNISMU v10...\n");

  // ── CHECK CONSTRAINT stok >= 0 ─────────────────────────────────────────────
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE books ADD CONSTRAINT chk_stok_non_negative CHECK (stok >= 0)"
    );
    console.log("✅ CHECK constraint stok >= 0 ditambahkan");
  } catch (e) {
    if (!e.message?.includes("Duplicate") && !e.message?.includes("1061"))
      console.warn("⚠️  CHECK constraint:", e.message);
    else
      console.log("✅ CHECK constraint stok >= 0 sudah ada");
  }

  // ── SETTINGS ───────────────────────────────────────────────────────────────
  const settings = [
    ["nama_perpustakaan", "Perpustakaan UNISMU",                    "Nama Perpustakaan",           "umum"],
    ["email",             "perpus@unismu.ac.id",                    "Email Resmi",                 "umum"],
    ["phone",             "(022) 2641600",                          "No. Telepon",                 "umum"],
    ["alamat",            "Jl. Raya Ciawi No.1, Purwakarta, Jawa Barat", "Alamat",                "umum"],
    ["website",           "https://perpus.unismu.ac.id",            "Website",                    "umum"],
    ["durasi_pinjam",     "14",    "Durasi Pinjam Default (hari)",  "peminjaman"],
    ["max_pinjam",        "3",     "Maks. Buku per Anggota",        "peminjaman"],
    ["denda_per_hari",    "1000",  "Denda Keterlambatan/Hari (Rp)", "peminjaman"],
    ["token_durasi",      "14",    "Durasi Token Default (hari)",   "peminjaman"],
    ["maintenance",       "false", "Mode Maintenance",              "sistem"],
    ["banner_aktif",      "false", "Banner Aktif",                  "banner"],
    ["banner_text",       "Selamat datang di Perpustakaan Digital UNISMU 📚", "Teks Banner", "banner"],
    ["banner_color",      "#6366f1", "Warna Banner",                "banner"],
    ["pengumuman",        "",      "Pengumuman",                    "banner"],
    ["verifikasi_email",  "false", "Wajib Verifikasi Email",        "anggota"],
    ["card_expiry_tahun", "1",     "Masa Berlaku Kartu (tahun)",    "anggota"],
    ["kategori_buku", JSON.stringify([
      "Sains & Teknologi", "Hukum & Syariah", "Ekonomi & Bisnis",
      "Pendidikan", "Agama & Filsafat", "Kesehatan", "Sosial & Politik", "Bahasa & Sastra",
    ]), "Kategori Buku", "koleksi"],
  ];
  for (const [key, value, label, group] of settings)
    await upsertSetting(key, value, label, group);
  console.log("✅ Settings (17)");

  // ── FAKULTAS & PRODI ───────────────────────────────────────────────────────
  const fakData = [
    { nama: "Fakultas Ekonomi dan Bisnis",       kode: "FEB",  warna: "#f59e0b", prodi: [
      { nama: "Manajemen",    kode: "MNJ01", jenjang: "S1" },
      { nama: "Akuntansi",    kode: "AKT01", jenjang: "S1" },
    ]},
    { nama: "Fakultas Teknik dan Ilmu Komputer", kode: "FTIK", warna: "#6366f1", prodi: [
      { nama: "Teknik Mesin",     kode: "TM01", jenjang: "S1" },
      { nama: "Teknik Elektro",   kode: "TE01", jenjang: "S1" },
      { nama: "Sistem Informasi", kode: "SI01", jenjang: "S1" },
    ]},
    { nama: "Fakultas Hukum",                    kode: "FH",   warna: "#10b981", prodi: [
      { nama: "Ilmu Hukum", kode: "IH01", jenjang: "S1" },
    ]},
    { nama: "Perpustakaan",                      kode: "PERP", warna: "#6366f1", prodi: [] },
  ];

  const fakMap = {}, prodiMap = {};
  for (const f of fakData) {
    const fak = await prisma.fakultas.upsert({
      where:  { kode: f.kode },
      update: {},
      create: { nama: f.nama, kode: f.kode, warna: f.warna },
    });
    fakMap[f.kode] = fak.id;
    for (const p of f.prodi) {
      const pr = await prisma.prodi.upsert({
        where:  { kode: p.kode },
        update: {},
        create: { nama: p.nama, kode: p.kode, jenjang: p.jenjang, fakultasId: fak.id },
      });
      prodiMap[p.kode] = pr.id;
    }
  }
  console.log("✅ Fakultas & Prodi");

  // ── USERS ──────────────────────────────────────────────────────────────────
  const cardExpiry = new Date(Date.now() + 365 * 864e5);
  const now        = new Date();

  const usersData = [
    // Pustakawan Universitas
    { name: "Dr. Hj. Siti Aminah, M.Lib.",       nim: "PUSUNIV01",  pw: "PusUniv@UNISMU2024", role: "pustakawan_universitas", email: "pustakawan.univ@unismu.ac.id",  fakKode: "PERP", prodiKode: null },
    // Pustakawan Fakultas
    { name: "Ahmad Fauzi, S.IP.",                  nim: "PUSFEB01",   pw: "PusFEB@123",         role: "pustakawan_fakultas",    email: "pustakawan.feb@unismu.ac.id",   fakKode: "FEB",  prodiKode: null },
    { name: "Nanda Fitriani, S.IP.",               nim: "PUSFTIK01",  pw: "PusFTIK@123",        role: "pustakawan_fakultas",    email: "pustakawan.ftik@unismu.ac.id",  fakKode: "FTIK", prodiKode: null },
    { name: "Hj. Rohani Salam, S.Sos.",            nim: "PUSFH01",    pw: "PusFH@123",          role: "pustakawan_fakultas",    email: "pustakawan.fh@unismu.ac.id",    fakKode: "FH",   prodiKode: null },
    // Mahasiswa
    { name: "Rizky Aditya Pratama",                nim: "2021001001", pw: "Mahasiswa@123",      role: "mahasiswa", email: "rizky@student.unismu.ac.id",   fakKode: "FTIK", prodiKode: "SI01",  angkatan: "2021" },
    { name: "Siti Nur Halimah",                    nim: "2022003001", pw: "Mahasiswa@123",      role: "mahasiswa", email: "halimah@student.unismu.ac.id", fakKode: "FH",   prodiKode: "IH01",  angkatan: "2022" },
    { name: "Ahmad Baihaki",                       nim: "2020005001", pw: "Mahasiswa@123",      role: "mahasiswa", email: "baihaki@student.unismu.ac.id", fakKode: "FEB",  prodiKode: "MNJ01", angkatan: "2020" },
    // Umum
    { name: "Prof. Dr. H. Burhan Ilham, S.H.",    nim: "DSN001",     pw: "Dosen@123",          role: "umum", email: "burhan@unismu.ac.id",  fakKode: "FH",   prodiKode: null, tipe: "Dosen" },
    { name: "Sari Dewi Rahayu, S.Pd.",             nim: "TDK001",     pw: "Tendik@123",         role: "umum", email: "sari@unismu.ac.id",    fakKode: "FTIK", prodiKode: null, tipe: "Tenaga_Kependidikan" },
    { name: "Masyarakat Umum",                     nim: "UMUM01",     pw: "Umum@123",           role: "umum", email: "umum@gmail.com",       fakKode: null,   prodiKode: null, tipe: "Masyarakat", isVerified: false },
  ];

  for (const u of usersData) {
    const exists = await prisma.user.findUnique({ where: { nim: u.nim } });
    if (!exists) {
      await prisma.user.create({
        data: {
          name: u.name, nim: u.nim, password: hash(u.pw),
          role: u.role, tipe: u.tipe || null,
          email: u.email, phone: null,
          angkatan: u.angkatan || null,
          isVerified:  u.isVerified !== false,
          isActive:    true, cardExpiry,
          passwordChangedAt: now,
          fakultasId:  u.fakKode   ? fakMap[u.fakKode]    : null,
          prodiId:     u.prodiKode ? prodiMap[u.prodiKode] : null,
        },
      });
    }
  }
  console.log("✅ Users (10)");

  // ── BUKU ───────────────────────────────────────────────────────────────────
  const books = [
    { title: "Kalkulus dan Matematika Teknik Lanjutan",  author: "Dr. Ahmad Fauzi, M.T.",              year: 2023, category: "Sains & Teknologi", isbn: "978-602-123-001", pages: 380, stok: 5, lokasi: "Rak A1-01", rating: 4.8, downloads: 1240, badge: "Populer",    coverColor1: "#6366f1", coverColor2: "#8b5cf6", abstract: "Konsep dasar kalkulus diferensial dan integral serta aplikasinya dalam rekayasa teknik." },
    { title: "Hukum Perdata Islam Indonesia",            author: "Prof. Dr. Hj. Siti Aminah, S.H.",   year: 2023, category: "Hukum & Syariah",   isbn: "978-602-123-002", pages: 442, stok: 3, lokasi: "Rak B2-05", rating: 4.7, downloads:  890, badge: "Baru",       coverColor1: "#10b981", coverColor2: "#059669", abstract: "Kajian mendalam tentang hukum perdata Islam yang berlaku di Indonesia." },
    { title: "Manajemen Keuangan Syariah Modern",        author: "Dr. Muh. Ridwan, S.E., M.Si.",      year: 2023, category: "Ekonomi & Bisnis",  isbn: "978-602-123-003", pages: 316, stok: 7, lokasi: "Rak C3-02", rating: 4.6, downloads: 1105, badge: "Baru",       coverColor1: "#f59e0b", coverColor2: "#d97706", abstract: "Prinsip manajemen keuangan berbasis nilai-nilai syariah Islam." },
    { title: "Psikologi Pendidikan Islam",               author: "Dr. Nur Hidayati, M.Pd.",           year: 2022, category: "Pendidikan",        isbn: "978-602-123-004", pages: 298, stok: 2, lokasi: "Rak D4-08", rating: 4.5, downloads:  763, badge: null,          coverColor1: "#ec4899", coverColor2: "#db2777", abstract: "Teori psikologi yang diintegrasikan dengan nilai-nilai pendidikan Islam." },
    { title: "Rekayasa Perangkat Lunak Profesional",     author: "Ir. Budi Santoso, M.T., Ph.D.",     year: 2023, category: "Sains & Teknologi", isbn: "978-602-123-005", pages: 528, stok: 4, lokasi: "Rak A1-05", rating: 4.9, downloads: 1892, badge: "Best Seller", coverColor1: "#3b82f6", coverColor2: "#2563eb", abstract: "Metodologi SDLC, UML, design patterns, dan agile development." },
    { title: "Filsafat Islam Kontemporer",               author: "Prof. Dr. H. Syamsul Bahri, M.Ag.", year: 2022, category: "Agama & Filsafat",  isbn: "978-602-123-006", pages: 356, stok: 6, lokasi: "Rak E5-01", rating: 4.7, downloads:  542, badge: null,          coverColor1: "#ef4444", coverColor2: "#dc2626", abstract: "Eksplorasi pemikiran filsafat Islam dalam konteks kehidupan modern." },
    { title: "Ilmu Gizi dan Kesehatan Masyarakat",       author: "Dr. Sari Wulandari, M.Kes.",        year: 2023, category: "Kesehatan",         isbn: "978-602-123-007", pages: 270, stok: 8, lokasi: "Rak F6-03", rating: 4.6, downloads:  934, badge: "Baru",       coverColor1: "#14b8a6", coverColor2: "#0d9488", abstract: "Dasar ilmu gizi dan penerapannya dalam kesehatan masyarakat." },
    { title: "Administrasi Publik & Good Governance",    author: "Dr. Hasrul Sani, M.Si.",            year: 2022, category: "Sosial & Politik",  isbn: "978-602-123-008", pages: 324, stok: 2, lokasi: "Rak G7-04", rating: 4.4, downloads:  687, badge: null,          coverColor1: "#8b5cf6", coverColor2: "#7c3aed", abstract: "Konsep administrasi publik modern dalam tata kelola pemerintahan." },
    { title: "Akuntansi Keuangan Syariah",               author: "Dr. Rahayu Kusumastuti, Ak.",       year: 2023, category: "Ekonomi & Bisnis",  isbn: "978-602-123-009", pages: 460, stok: 5, lokasi: "Rak C3-07", rating: 4.8, downloads: 1023, badge: "Populer",    coverColor1: "#f97316", coverColor2: "#ea580c", abstract: "Standar akuntansi keuangan syariah pada entitas bisnis Islam." },
    { title: "Linguistik Arab Modern",                   author: "Prof. Dr. Abdullah Hamid, M.A.",    year: 2022, category: "Bahasa & Sastra",   isbn: "978-602-123-010", pages: 286, stok: 3, lokasi: "Rak H8-02", rating: 4.5, downloads:  478, badge: null,          coverColor1: "#06b6d4", coverColor2: "#0891b2", abstract: "Kajian linguistik bahasa Arab dari perspektif modern." },
    { title: "Teknik Pemrograman Web Modern",            author: "Ir. Andi Pratama, M.Kom.",          year: 2023, category: "Sains & Teknologi", isbn: "978-602-123-011", pages: 510, stok: 9, lokasi: "Rak A1-09", rating: 4.9, downloads: 1567, badge: "Best Seller", coverColor1: "#84cc16", coverColor2: "#65a30d", abstract: "Panduan lengkap HTML5, CSS3, JavaScript, React, Vue, Node.js." },
    { title: "Sosiologi Dakwah Islam",                   author: "Dr. Hajriyah Mahyuddin, M.Ag.",     year: 2022, category: "Agama & Filsafat",  isbn: "978-602-123-012", pages: 234, stok: 4, lokasi: "Rak E5-06", rating: 4.3, downloads:  391, badge: null,          coverColor1: "#a855f7", coverColor2: "#9333ea", abstract: "Analisis sosiologis terhadap praktik dakwah Islam di Indonesia." },
    { title: "Ekonomi Makro Islam",                      author: "Dr. Hamid Patilima, M.Si.",         year: 2023, category: "Ekonomi & Bisnis",  isbn: "978-602-123-013", pages: 395, stok: 6, lokasi: "Rak C4-01", rating: 4.5, downloads:  621, badge: "Baru",       coverColor1: "#16a34a", coverColor2: "#15803d", abstract: "Teori dan praktek ekonomi makro dalam perspektif ekonomi Islam global." },
    { title: "Tafsir Al-Quran Tematik",                  author: "Prof. Dr. KH. Nashruddin Baidan",  year: 2022, category: "Agama & Filsafat",  isbn: "978-602-123-014", pages: 512, stok: 3, lokasi: "Rak E6-02", rating: 4.9, downloads:  845, badge: "Best Seller", coverColor1: "#0ea5e9", coverColor2: "#0284c7", abstract: "Kajian tafsir Al-Quran dengan pendekatan tematik." },
    { title: "Sejarah Peradaban Islam",                  author: "Dr. H. Badri Yatim, M.A.",         year: 2021, category: "Agama & Filsafat",  isbn: "978-602-123-015", pages: 448, stok: 5, lokasi: "Rak E7-03", rating: 4.6, downloads:  723, badge: "Populer",    coverColor1: "#d946ef", coverColor2: "#c026d3", abstract: "Perjalanan peradaban Islam dari masa Nabi hingga era kontemporer." },
    { title: "Bahasa Indonesia Akademik",                author: "Dr. Hj. Zulhadi, M.Pd.",           year: 2023, category: "Bahasa & Sastra",   isbn: "978-602-123-016", pages: 262, stok: 7, lokasi: "Rak H9-01", rating: 4.4, downloads:  534, badge: "Baru",       coverColor1: "#f43f5e", coverColor2: "#e11d48", abstract: "Panduan penulisan karya ilmiah dengan kaidah bahasa Indonesia yang benar." },
  ];

  for (const b of books)
    await prisma.book.upsert({ where: { isbn: b.isbn }, update: {}, create: b });
  console.log("✅ Buku (16)");

  // ── JURNAL ─────────────────────────────────────────────────────────────────
  const jurnals = [
    { title: "Journal of Economics and Business UNISMU", issn: "2302-0011", year: 2024, articles: 8,  penerbit: "FEB UNISMU",  editor: "Dr. Ahmad Rizaldi, S.E., M.Si.",    frekuensi: "2x setahun", warna: "#f59e0b" },
    { title: "UNISMU Law Review",                        issn: "2303-1212", year: 2024, articles: 6,  penerbit: "FH UNISMU",   editor: "Prof. Dr. Hj. Siti Aminah, S.H.",   frekuensi: "2x setahun", warna: "#10b981" },
    { title: "Jurnal Teknologi dan Informatika UNISMU",  issn: "2304-2323", year: 2024, articles: 10, penerbit: "FTIK UNISMU", editor: "Ir. Andi Pratama, M.Kom.",            frekuensi: "3x setahun", warna: "#6366f1" },
  ];

  for (const j of jurnals) {
    const exists = await prisma.jurnal.findFirst({ where: { issn: j.issn } });
    if (!exists) await prisma.jurnal.create({ data: { ...j, isActive: true } });
  }
  console.log("✅ Jurnal (3)");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SEED SELESAI — Akun Default:");
  console.log("═══════════════════════════════════════════════════");
  console.log("  PUSTAKAWAN UNIVERSITAS");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  PUSUNIV01   │ PusUniv@UNISMU2024  │ Super Admin");
  console.log("  PUSTAKAWAN FAKULTAS");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  PUSFEB01    │ PusFEB@123          │ Fak. Ekonomi");
  console.log("  PUSFTIK01   │ PusFTIK@123         │ Fak. Teknik");
  console.log("  PUSFH01     │ PusFH@123           │ Fak. Hukum");
  console.log("  MEMBER");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  2021001001  │ Mahasiswa@123       │ Mahasiswa");
  console.log("  2022003001  │ Mahasiswa@123       │ Mahasiswa");
  console.log("  2020005001  │ Mahasiswa@123       │ Mahasiswa");
  console.log("  DSN001      │ Dosen@123           │ Dosen");
  console.log("  TDK001      │ Tendik@123          │ Tendik");
  console.log("  UMUM01      │ Umum@123            │ Masyarakat");
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch(e => { console.error("❌ Seed error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
