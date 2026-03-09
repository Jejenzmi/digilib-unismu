// tests/integration/books.test.js
const request = require("supertest");
const { createApp } = require("../../src/index");
const { seedTestDb, cleanTestDb } = require("../setup/testDb");

let app, db;
let tokenKepala, tokenPustakawan, tokenMahasiswa;

beforeAll(async () => {
  app = createApp();
  db  = await seedTestDb();

  const [resK, resP, resM] = await Promise.all([
    request(app).post("/api/auth/login").send({ nim: "KP001",       password: "Admin@UNISMU2024" }),
    request(app).post("/api/auth/login").send({ nim: "PUS001",      password: "Pustaka@123" }),
    request(app).post("/api/auth/login").send({ nim: "2021001001",  password: "Mahasiswa@123" }),
  ]);

  tokenKepala    = resK.body.data.accessToken;
  tokenPustakawan= resP.body.data.accessToken;
  tokenMahasiswa = resM.body.data.accessToken;
});

afterAll(async () => {
  await cleanTestDb();
});

// ─── GET /api/books ──────────────────────────────────────────────────────────
describe("GET /api/books", () => {
  it("mengembalikan daftar buku aktif (publik, tanpa login)", async () => {
    const res = await request(app).get("/api/books");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toHaveProperty("total");
    // Buku nonaktif tidak tampil
    const titles = res.body.data.map(b => b.title);
    expect(titles).not.toContain("Buku Nonaktif");
  });

  it("mendukung pagination — limit dan page", async () => {
    const res = await request(app).get("/api/books?page=1&limit=1");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
    expect(res.body.pagination.limit).toBe(1);
  });

  it("mendukung pencarian berdasarkan judul", async () => {
    const res = await request(app).get("/api/books?search=Alpha");
    expect(res.status).toBe(200);
    const found = res.body.data.some(b => b.title.includes("Alpha"));
    expect(found).toBe(true);
  });

  it("mendukung filter berdasarkan kategori", async () => {
    const res = await request(app).get("/api/books?category=Sains %26 Teknologi");
    expect(res.status).toBe(200);
    res.body.data.forEach(b => {
      expect(b.category).toBe("Sains & Teknologi");
    });
  });
});

// ─── GET /api/books/:id ──────────────────────────────────────────────────────
describe("GET /api/books/:id", () => {
  it("mengembalikan detail buku yang ada", async () => {
    const res = await request(app).get(`/api/books/${db.buku1.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(db.buku1.id);
    expect(res.body.data.title).toBe("Buku Test Alpha");
  });

  it("404 jika buku tidak ditemukan", async () => {
    const res = await request(app).get("/api/books/9999999");
    expect(res.status).toBe(404);
  });

  it("404 jika buku nonaktif", async () => {
    const res = await request(app).get(`/api/books/${db.bukuNonaktif.id}`);
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/books ─────────────────────────────────────────────────────────
describe("POST /api/books", () => {
  it("admin bisa menambah buku baru", async () => {
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenPustakawan}`)
      .field("title", "Buku Baru dari Test")
      .field("author", "Penulis Test")
      .field("year", "2024")
      .field("category", "Pendidikan");

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe("Buku Baru dari Test");
    expect(res.body.data.isActive).toBe(true);
  });

  it("gagal tanpa autentikasi", async () => {
    const res = await request(app)
      .post("/api/books")
      .send({ title: "Test", author: "Test", year: 2024, category: "Pendidikan" });
    expect(res.status).toBe(401);
  });

  it("mahasiswa tidak bisa menambah buku", async () => {
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenMahasiswa}`)
      .field("title", "Buku Mahasiswa")
      .field("author", "Penulis")
      .field("year", "2024")
      .field("category", "Pendidikan");
    expect(res.status).toBe(403);
  });

  it("gagal validasi jika field wajib kosong", async () => {
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("title", "")
      .field("author", "")
      .field("year", "2024")
      .field("category", "");

    expect(res.status).toBe(422);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it("gagal jika ISBN duplikat", async () => {
    // Tambah buku pertama
    await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("title", "Buku ISBN Test 1")
      .field("author", "Penulis")
      .field("year", "2024")
      .field("category", "Pendidikan")
      .field("isbn", "978-111-dup-001");

    // Tambah buku kedua dengan ISBN sama
    const res2 = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("title", "Buku ISBN Test 2")
      .field("author", "Penulis")
      .field("year", "2024")
      .field("category", "Pendidikan")
      .field("isbn", "978-111-dup-001");

    expect(res2.status).toBe(409);
    expect(res2.body.message).toMatch(/isbn|sudah digunakan/i);
  });
});

// ─── PUT /api/books/:id ──────────────────────────────────────────────────────
describe("PUT /api/books/:id", () => {
  it("admin bisa memperbarui buku", async () => {
    const res = await request(app)
      .put(`/api/books/${db.buku1.id}`)
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("stok", "99")
      .field("badge", "Populer");

    expect(res.status).toBe(200);
    expect(res.body.data.stok).toBe(99);
    expect(res.body.data.badge).toBe("Populer");
  });

  it("gagal dengan badge tidak valid", async () => {
    const res = await request(app)
      .put(`/api/books/${db.buku1.id}`)
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("badge", "BadgeAsal");

    expect(res.status).toBe(422);
  });

  it("404 jika buku tidak ditemukan", async () => {
    const res = await request(app)
      .put("/api/books/9999999")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("stok", "5");
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/books/:id ───────────────────────────────────────────────────
describe("DELETE /api/books/:id", () => {
  it("kepala bisa menghapus buku (soft delete)", async () => {
    // Buat buku baru dulu supaya tidak mempengaruhi test lain
    const createRes = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("title", "Buku Hapus Test")
      .field("author", "Penulis")
      .field("year", "2024")
      .field("category", "Pendidikan");

    const id = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/books/${id}`)
      .set("Authorization", `Bearer ${tokenKepala}`);

    expect(res.status).toBe(200);

    // Verifikasi buku tidak tampil di publik
    const checkRes = await request(app).get(`/api/books/${id}`);
    expect(checkRes.status).toBe(404);
  });

  it("pustakawan tidak bisa menghapus (hanya kepala)", async () => {
    const res = await request(app)
      .delete(`/api/books/${db.buku1.id}`)
      .set("Authorization", `Bearer ${tokenPustakawan}`);
    expect(res.status).toBe(403);
  });
});

// ─── Sanitasi XSS ────────────────────────────────────────────────────────────
describe("XSS Sanitization", () => {
  it("judul dengan script tag disanitasi sebelum disimpan", async () => {
    const res = await request(app)
      .post("/api/books")
      .set("Authorization", `Bearer ${tokenKepala}`)
      .field("title", "<script>alert('xss')</script>Buku XSS")
      .field("author", "Penulis Test")
      .field("year", "2024")
      .field("category", "Pendidikan");

    expect(res.status).toBe(201);
    // express-validator .escape() mengkonversi < > menjadi entitas HTML
    expect(res.body.data.title).not.toContain("<script>");
    expect(res.body.data.title).not.toContain("</script>");
  });
});
