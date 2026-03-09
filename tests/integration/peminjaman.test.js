// tests/integration/peminjaman.test.js
const request = require("supertest");
const { createApp } = require("../../src/index");
const { seedTestDb, cleanTestDb, prisma } = require("../setup/testDb");

let app, db;
let tokenKepala, tokenPustakawan, tokenMahasiswa;

beforeAll(async () => {
  app = createApp();
  db  = await seedTestDb();

  const [resK, resP, resM] = await Promise.all([
    request(app).post("/api/auth/login").send({ nim: "KP001",      password: "Admin@UNISMU2024" }),
    request(app).post("/api/auth/login").send({ nim: "PUS001",     password: "Pustaka@123" }),
    request(app).post("/api/auth/login").send({ nim: "2021001001", password: "Mahasiswa@123" }),
  ]);

  tokenKepala    = resK.body.data.accessToken;
  tokenPustakawan= resP.body.data.accessToken;
  tokenMahasiswa = resM.body.data.accessToken;
});

afterAll(async () => {
  await cleanTestDb();
});

// ─── POST /api/peminjaman (pinjam) ────────────────────────────────────────────
describe("POST /api/peminjaman", () => {
  it("mahasiswa bisa meminjam buku yang tersedia", async () => {
    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: db.buku1.id, durasi: 7 });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("dipinjam");
    expect(res.body.data.durasi).toBe(7);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.token).toMatch(/^UNISMU-/);
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("gagal meminjam buku yang sama dua kali", async () => {
    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: db.buku1.id });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sudah meminjam/i);
  });

  it("gagal meminjam buku dengan stok habis", async () => {
    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: db.buku2.id }); // stok = 0

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stok.*habis/i);
  });

  it("gagal meminjam buku yang tidak ada", async () => {
    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: 9999999 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tidak ditemukan/i);
  });

  it("gagal tanpa autentikasi", async () => {
    const res = await request(app)
      .post("/api/peminjaman")
      .send({ bookId: db.buku1.id });
    expect(res.status).toBe(401);
  });

  it("gagal dengan durasi di luar range 1–60", async () => {
    // Buat buku baru agar mahasiswa bisa pinjam
    const buku = await prisma.book.create({
      data: { title: "Buku Durasi Test", author: "Penulis", year: 2024,
              category: "Pendidikan", stok: 5,
              coverColor1: "#6366f1", coverColor2: "#8b5cf6" },
    });

    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: buku.id, durasi: 100 }); // di atas 60

    expect(res.status).toBe(422);
    expect(res.body.errors[0].field).toBe("durasi");
  });
});

// ─── POST /api/peminjaman/verify-token ───────────────────────────────────────
describe("POST /api/peminjaman/verify-token", () => {
  let validToken;

  beforeAll(async () => {
    // Buat buku baru dan pinjam supaya ada token
    const buku = await prisma.book.create({
      data: { title: "Buku Token Test", author: "Penulis", year: 2024,
              category: "Pendidikan", stok: 3,
              coverColor1: "#6366f1", coverColor2: "#8b5cf6" },
    });
    const pinjamRes = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: buku.id, durasi: 14 });

    validToken = pinjamRes.body.data.token;
  });

  it("token valid mengembalikan valid=true", async () => {
    const res = await request(app)
      .post("/api/peminjaman/verify-token")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ token: validToken });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.daysLeft).toBeGreaterThan(0);
  });

  it("token palsu mengembalikan valid=false, reason=invalid", async () => {
    const res = await request(app)
      .post("/api/peminjaman/verify-token")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ token: "TOKEN-PALSU-ASAL" });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.reason).toBe("invalid");
  });
});

// ─── GET /api/peminjaman ─────────────────────────────────────────────────────
describe("GET /api/peminjaman", () => {
  it("mahasiswa hanya melihat peminjaman sendiri", async () => {
    const res = await request(app)
      .get("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(p => {
      expect(p.user.nim).toBe("2021001001");
    });
  });

  it("admin melihat semua peminjaman", async () => {
    const res = await request(app)
      .get("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenPustakawan}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBeGreaterThan(0);
  });

  it("admin bisa filter by status", async () => {
    const res = await request(app)
      .get("/api/peminjaman?status=dipinjam")
      .set("Authorization", `Bearer ${tokenKepala}`);

    expect(res.status).toBe(200);
    res.body.data.forEach(p => expect(p.status).toBe("dipinjam"));
  });

  it("gagal tanpa autentikasi", async () => {
    const res = await request(app).get("/api/peminjaman");
    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/peminjaman/:id/kembalikan ──────────────────────────────────────
describe("PUT /api/peminjaman/:id/kembalikan", () => {
  let peminjamanId, stokAwal;

  beforeAll(async () => {
    // Buat buku khusus untuk test kembalikan
    const buku = await prisma.book.create({
      data: { title: "Buku Kembalikan Test", author: "Penulis", year: 2024,
              category: "Pendidikan", stok: 2,
              coverColor1: "#6366f1", coverColor2: "#8b5cf6" },
    });
    stokAwal = buku.stok;

    const res = await request(app)
      .post("/api/peminjaman")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .send({ bookId: buku.id });

    peminjamanId = res.body.data.id;
  });

  it("admin bisa memproses pengembalian", async () => {
    const res = await request(app)
      .put(`/api/peminjaman/${peminjamanId}/kembalikan`)
      .set("Authorization", `Bearer ${tokenPustakawan}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("dikembalikan");
    expect(res.body.data.tanggalDikembalikan).toBeTruthy();
    // Stok harus kembali naik
    const buku = await prisma.book.findUnique({ where: { id: res.body.data.bookId } });
    expect(buku.stok).toBe(stokAwal);
  });

  it("gagal mengembalikan buku yang sudah dikembalikan", async () => {
    const res = await request(app)
      .put(`/api/peminjaman/${peminjamanId}/kembalikan`)
      .set("Authorization", `Bearer ${tokenPustakawan}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sudah dikembalikan/i);
  });

  it("mahasiswa tidak bisa memproses pengembalian", async () => {
    const res = await request(app)
      .put(`/api/peminjaman/${peminjamanId}/kembalikan`)
      .set("Authorization", `Bearer ${tokenMahasiswa}`);
    expect(res.status).toBe(403);
  });
});
