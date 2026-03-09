// tests/integration/auth.test.js
const request = require("supertest");
const { createApp } = require("../../src/index");
const { seedTestDb, cleanTestDb } = require("../setup/testDb");

let app, db;

beforeAll(async () => {
  app = createApp();
  db  = await seedTestDb();
});

afterAll(async () => {
  await cleanTestDb();
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe("POST /api/auth/login", () => {
  it("berhasil login dengan kredensial benar", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "KP001", password: "Admin@UNISMU2024" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user).toHaveProperty("role", "kepala");
    expect(res.body.data.user).not.toHaveProperty("password");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("gagal dengan password salah — pesan identik (anti enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "KP001", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("NIM atau password salah.");
  });

  it("gagal dengan NIM yang tidak ada — pesan identik (anti enumeration)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "NIMTIDAKADA", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("NIM atau password salah.");
  });

  it("gagal jika akun dinonaktifkan", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "NONAKTIF01", password: "Test@1234" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/dinonaktifkan/i);
  });

  it("gagal validasi jika nim kosong", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "", password: "Admin@UNISMU2024" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "nim" }),
      ])
    );
  });

  it("respons selalu memiliki X-Request-Id header", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "TIDAKADA", password: "salah" });

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.body.requestId).toBeDefined();
    expect(res.headers["x-request-id"]).toBe(res.body.requestId);
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
describe("POST /api/auth/refresh", () => {
  let refreshToken;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "PUS001", password: "Pustaka@123" });
    refreshToken = res.body.data.refreshToken;
  });

  it("berhasil mendapatkan access token baru", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("gagal dengan refresh token tidak valid", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "tokenpalsu.tidakvalid.abcde" });

    expect(res.status).toBe(401);
  });

  it("gagal jika refresh token tidak disertakan", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe("GET /api/auth/me", () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ nim: "2021001001", password: "Mahasiswa@123" });
    token = res.body.data.accessToken;
  });

  it("mengembalikan data user tanpa password", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("nim", "2021001001");
    expect(res.body.data).toHaveProperty("role", "mahasiswa");
    expect(res.body.data).not.toHaveProperty("password");
    expect(res.body.data).not.toHaveProperty("refreshTokens");
  });

  it("gagal tanpa token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("gagal dengan token palsu", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer ini.token.palsu");
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("berhasil logout", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ nim: "KP001", password: "Admin@UNISMU2024" });
    const { accessToken, refreshToken } = loginRes.body.data;

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── PUT /api/auth/change-password ───────────────────────────────────────────
describe("PUT /api/auth/change-password", () => {
  it("gagal jika password lama salah", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ nim: "2021001001", password: "Mahasiswa@123" });
    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "SALAH@Pass1", newPassword: "NewPass@123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password lama salah/i);
  });

  it("gagal validasi jika password baru terlalu lemah", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ nim: "2021001001", password: "Mahasiswa@123" });
    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .put("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ oldPassword: "Mahasiswa@123", newPassword: "lemah" });

    expect(res.status).toBe(422);
  });
});
