# 📚 Digilib UNISMU — Backend API v3.2

REST API Perpustakaan Digital **Universitas Islam Dr. Khez Muttaqien (UNISMU)**.

**Stack:** Node.js 20 · Express.js · Prisma ORM · MySQL 8 · Docker

---

## ✅ Checklist Production-Readiness v3.2

| # | Item | v3 | v3.1 | v3.2 |
|---|---|:---:|:---:|:---:|
| 1 | Route ordering bug `fakultas.routes.js` | ✅ | ✅ | ✅ |
| 2 | Jest + `.env.test` + test DB isolation | ✅ | ✅ | ✅ |
| 3 | Swagger JSDoc lengkap semua routes | ✅ | ✅ | ✅ |
| 4 | XSS sanitization via `express-validator` | ✅ | ✅ | ✅ |
| 5 | Request ID setiap request/response | ✅ | ✅ | ✅ |
| 6 | Seed idempotent (aman Docker restart) | ✅ | ✅ | ✅ |
| 7 | Cron tidak jalan saat `NODE_ENV=test` | ✅ | ✅ | ✅ |
| 8 | `prisma` CLI di `dependencies` | ❌ | ✅ | ✅ |
| 9 | Race condition stok — interactive tx | ❌ | ✅ | ✅ |
| 10 | `trust proxy` untuk `req.ip` benar | ❌ | ✅ | ✅ |
| 11 | CORS izinkan `localhost` untuk Swagger | ❌ | ✅ | ✅ |
| **12** | **`npm install` (bukan `npm ci`) di Dockerfile** | ❌ | ❌ | ✅ |
| **13** | **`prisma db push` tanpa `--accept-data-loss`** | ❌ | ❌ | ✅ |
| **14** | **Helmet CSP dikonfigurasi — Swagger tidak terblok** | ❌ | ❌ | ✅ |
| **15** | **`PrismaClientUnknownRequestError` ditangani** | ❌ | ❌ | ✅ |
| **16** | **`kembalikan()` dalam interactive transaction** | ❌ | ❌ | ✅ |
| **17** | **`downloads` increment setelah `res.finish`** | ❌ | ❌ | ✅ |
| **18** | **`.env.test` tidak ikut ZIP — ada `.env.test.example`** | ❌ | ❌ | ✅ |

---

## 🔧 Changelog v3.2

### Fix 5 — `npm install` menggantikan `npm ci` di Dockerfile
`npm ci` wajib ada `package-lock.json`. File lock tidak di-commit ke repo → `docker build` crash saat pertama kali.
```diff
- RUN npm ci --omit=dev
+ RUN npm install --omit=dev --no-audit --no-fund
```

### Fix 6 — `prisma db push` tanpa flag berbahaya
```diff
- npx prisma db push --accept-data-loss   # bisa DROP kolom & data!
+ npx prisma db push                      # aman, tolak jika ada destructive change
```
Jika schema berubah secara destructive, container akan gagal start dengan jelas — bukan diam-diam menghapus data.

### Fix 7 — Helmet CSP dikonfigurasi untuk Swagger UI
Default `helmet()` memblok semua inline scripts dan CDN — Swagger UI tampil kosong/broken.
```js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", ...],
      styleSrc:  ["'self'", "'unsafe-inline'", ...],
    }
  }
}));
```

### Fix 8 — `PrismaClientUnknownRequestError` ditangani
MySQL CHECK constraint violation (`stok >= 0`) melempar `PrismaClientUnknownRequestError` yang sebelumnya tidak ditangkap → response 500.
```js
if (err instanceof Prisma.PrismaClientUnknownRequestError) {
  if (msg.includes("3819") || msg.includes("check constraint"))
    return { status: 400, message: "Stok buku tidak boleh negatif." };
  if (msg.includes("1213") || msg.includes("deadlock"))
    return { status: 409, message: "Konflik data bersamaan. Silakan coba lagi." };
}
```

### Fix 9 — `kembalikan()` dalam interactive transaction
Race condition sama seperti `pinjam()` di v3.1: dua admin proses pengembalian bersamaan bisa increment stok dua kali. Sekarang cek status + update dalam satu `tx` atomic.

### Fix 10 — `downloads` increment setelah transfer selesai
```js
// SEBELUM: counter naik dulu, baru kirim file
// Jika transfer gagal → counter salah
await prisma.book.update({ data: { downloads: { increment: 1 } } });
res.download(fp);

// SESUDAH: counter naik hanya setelah seluruh file berhasil dikirim
res.on("finish", () => {
  prisma.book.update({ data: { downloads: { increment: 1 } } }).catch(...)
});
res.download(fp);
```
Diterapkan di `book.controller.js` dan `skripsi.controller.js`.

REST API Perpustakaan Digital **Universitas Islam Dr. Khez Muttaqien (UNISMU)**.

**Stack:** Node.js 20 · Express.js · Prisma ORM · MySQL 8 · Docker

---

## ✅ Checklist Production-Readiness v3.1

| # | Item | v3 | v3.1 |
|---|---|:---:|:---:|
| 1 | Route ordering bug `fakultas.routes.js` | ✅ | ✅ |
| 2 | Jest setup + `.env.test` + test database isolation | ✅ | ✅ |
| 3 | Swagger JSDoc lengkap di semua route files | ✅ | ✅ |
| 4 | XSS sanitization via `express-validator` | ✅ | ✅ |
| 5 | Request ID middleware | ✅ | ✅ |
| 6 | Seed idempotent (aman Docker restart) | ✅ | ✅ |
| 7 | Cron tidak jalan saat `NODE_ENV=test` | ✅ | ✅ |
| **8** | **`prisma` CLI di `dependencies` (bukan `devDeps`)** | ❌ | ✅ |
| **9** | **Race condition stok — interactive transaction atomic** | ❌ | ✅ |
| **10** | **`trust proxy` untuk `req.ip` benar di balik Nginx** | ❌ | ✅ |
| **11** | **CORS izinkan `localhost` untuk Swagger UI** | ❌ | ✅ |
| 12 | Anti user-enumeration pada login | ✅ | ✅ |
| 13 | Refresh token rotation + invalidasi saat ganti password | ✅ | ✅ |
| 14 | Graceful shutdown (SIGTERM/SIGINT) | ✅ | ✅ |
| 15 | Docker multi-stage, non-root user, healthcheck | ✅ | ✅ |
| 16 | Validasi environment saat startup | ✅ | ✅ |
| 17 | CHECK constraint `stok >= 0` di MySQL | ❌ | ✅ |
| 18 | `Content-Disposition` di CORS `exposedHeaders` (download) | ❌ | ✅ |

**v3.1 overall: ~95% production-ready**

---

## 🔧 Changelog v3.1 vs v3

### Fix 1 — Docker FATAL: `prisma` CLI dipindah ke `dependencies`
```diff
- "devDependencies": { "prisma": "^5.10.0" }
+ "dependencies":    { "prisma": "^5.10.0" }
```
Sebelumnya `npm ci --omit=dev` di Dockerfile tidak menginstall Prisma CLI,
sehingga `npx prisma db push` gagal saat container pertama kali naik.

### Fix 2 — Race condition stok: interactive transaction atomic
```js
// SEBELUM (v3) — window race condition antara cek dan decrement:
const book = await prisma.book.findUnique(...)  // cek stok di luar tx
if (book.stok < 1) return fail(...)
await prisma.$transaction([...decrement...])    // decrement di dalam tx

// SESUDAH (v3.1) — cek + decrement dalam satu interactive tx:
await prisma.$transaction(async (tx) => {
  const book = await tx.book.findUnique(...)    // re-read di dalam tx
  if (book.stok < 1) return { error: ... }
  await tx.book.update({ data: { stok: { decrement: 1 } } })
})
```
Juga ditambahkan CHECK constraint MySQL `stok >= 0` sebagai safety net terakhir.

### Fix 3 — `trust proxy` untuk `req.ip` yang benar
```js
// Tanpa ini, semua user di belakang Nginx mendapat IP yang sama (172.x.x.x)
// → rate limiting login tidak bekerja sama sekali
if (env.isProd) app.set("trust proxy", 1);
```

### Fix 4 — CORS: localhost selalu diizinkan
```js
// Sebelumnya Swagger UI di browser diblock CORS jika FRONTEND_URL tidak
// menyertakan localhost secara eksplisit
const allowed = [
  ...env.frontendUrl.split(","),
  "http://localhost:3000",   // React dev
  "http://localhost:5000",   // API sendiri
  "http://localhost:5173",   // Vite dev
]
// + Content-Disposition ditambahkan ke exposedHeaders agar file download berfungsi
```

---

## 🚀 Cara Menjalankan

### Development (lokal)

```bash
npm install
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# Generate JWT secrets:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

npx prisma db push
npm run prisma:seed
npm run dev
```

### Docker (production)

```bash
cp .env.example .env
# Edit .env — wajib: JWT_SECRET, JWT_REFRESH_SECRET

docker-compose up -d
docker-compose logs -f api
```

---

## 🧪 Menjalankan Test

```bash
# Pastikan database test ada:
# mysql -u root -p -e "CREATE DATABASE digilib_unismu_test CHARACTER SET utf8mb4;"

npm test
npm run test:coverage
```

---

## 🔑 Akun Default (seed)

| Role | NIM / ID | Password |
|---|---|---|
| Kepala Perpustakaan | `KP001` | `Admin@UNISMU2024` |
| Pustakawan | `PUS001` | `Pustaka@123` |
| Mahasiswa | `2021001001` | `Mahasiswa@123` |
| Dosen | `DSN001` | `Dosen@123` |
| Umum | `UMUM01` | `Umum@123` |

---

## 📡 Endpoint Utama

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/api/health` | Publik | Health check + status DB |
| `GET` | `/api/docs` | Publik | Swagger UI |
| `POST` | `/api/auth/login` | Publik | Login |
| `POST` | `/api/auth/refresh` | Publik | Refresh token |
| `GET` | `/api/auth/me` | Login | Profil aktif |
| `GET` | `/api/books` | Publik | Daftar buku |
| `GET` | `/api/books/:id/download` | Login | Download PDF |
| `POST` | `/api/peminjaman` | Login | Pinjam buku |
| `POST` | `/api/peminjaman/verify-token` | Login | Verifikasi token baca |
| `PUT` | `/api/peminjaman/:id/kembalikan` | Admin | Proses pengembalian |
| `GET` | `/api/laporan/statistik` | Admin | Statistik dashboard |
| `GET` | `/api/laporan/export/buku` | Admin | Export Excel |

Dokumentasi lengkap: **`GET /api/docs`**

---

## 🔒 Keamanan

- JWT dual-token: access 15 menit + refresh 30 hari (rotation)
- bcrypt 12 rounds
- Rate limiting: 100 req/15 menit global, **10x/15 menit login per IP** (bekerja benar setelah fix `trust proxy`)
- XSS: semua input `.trim().escape()`
- Anti enumeration: pesan login identik
- Semua sesi dihapus saat ganti/reset password
- `X-Request-Id` di setiap request untuk log tracing
- Helmet security headers
- CORS whitelist
- Non-root Docker (UID 1001)
- **Race-free** stok peminjaman via interactive transaction
- CHECK constraint `stok >= 0` di MySQL

---

## ⚙️ Cron Jobs

| Waktu | Job |
|---|---|
| Startup | Catch-up status terlambat + denda |
| 00:01 WIB harian | Update terlambat + recalculate denda |
| 03:00 WIB harian | Hapus log > 90 hari |
| 02:00 WIB mingguan | Hapus refresh token expired |

> Cron **tidak aktif** saat `NODE_ENV=test`.

REST API Perpustakaan Digital **Universitas Islam Dr. Khez Muttaqien (UNISMU)**.

**Stack:** Node.js 20 · Express.js · Prisma ORM · MySQL 8 · Docker

---

## ✅ Checklist Production-Readiness v3

| # | Item | Status |
|---|---|---|
| 1 | Route ordering bug `fakultas.routes.js` (`/prodi/:id` sebelum `/:id`) | ✅ Fixed |
| 2 | Jest setup + `.env.test` + test database isolation | ✅ Fixed |
| 3 | Swagger JSDoc lengkap di semua 11 route files | ✅ Fixed |
| 4 | XSS sanitization via `express-validator` `.trim().escape()` | ✅ Fixed |
| 5 | Request ID middleware di setiap request/response | ✅ Fixed |
| 6 | Seed idempotent (upsert by unique key, aman Docker restart) | ✅ Fixed |
| 7 | Cron jobs tidak jalan saat `NODE_ENV=test` | ✅ Fixed |
| 8 | `createApp()` diekspos terpisah dari `.listen()` | ✅ Fixed |
| 9 | Anti user-enumeration pada login | ✅ |
| 10 | Refresh token rotation + invalidasi saat ganti password | ✅ |
| 11 | Graceful shutdown (SIGTERM/SIGINT) | ✅ |
| 12 | Docker multi-stage, non-root user, healthcheck | ✅ |
| 13 | Validasi environment saat startup | ✅ |
| 14 | Winston logger dengan file rotation | ✅ |
| 15 | Error messages dalam Bahasa Indonesia | ✅ |

---

## 🚀 Cara Menjalankan

### Development (lokal)

```bash
# 1. Install dependencies
npm install

# 2. Salin dan isi konfigurasi
cp .env.example .env
# Edit .env — isi DATABASE_URL dan JWT secrets

# 3. Generate JWT secrets (jalankan dua kali untuk dua secret berbeda)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Push schema ke database
npx prisma db push

# 5. Isi data awal
npm run prisma:seed

# 6. Jalankan server
npm run dev          # development (nodemon)
npm start            # production
```

### Docker (production)

```bash
# 1. Salin dan isi .env
cp .env.example .env
# Edit .env — wajib isi JWT_SECRET dan JWT_REFRESH_SECRET

# 2. Jalankan semua service
docker-compose up -d

# Cek log
docker-compose logs -f api

# Stop
docker-compose down
```

> 💡 **Docker restart aman** — seed berjalan tiap restart tapi menggunakan `upsert` sehingga data tidak duplikat.

---

## 🧪 Menjalankan Test

```bash
# Pastikan database test sudah dibuat:
# mysql -u root -p -e "CREATE DATABASE digilib_unismu_test CHARACTER SET utf8mb4;"

# Jalankan semua test
npm test

# Dengan coverage report
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

**Catatan:** Test menggunakan database terpisah (`digilib_unismu_test`). Cron jobs **tidak jalan** saat test.

---

## 🔑 Akun Login Default (dari seed)

| Role | NIM / ID | Password |
|---|---|---|
| Kepala Perpustakaan | `KP001` | `Admin@UNISMU2024` |
| Pustakawan | `PUS001` | `Pustaka@123` |
| Mahasiswa | `2021001001` | `Mahasiswa@123` |
| Dosen | `DSN001` | `Dosen@123` |
| Umum | `UMUM01` | `Umum@123` |

---

## 📡 Endpoint Utama

| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| `GET` | `/api/health` | Publik | Health check + status DB |
| `GET` | `/api/docs` | Publik | Swagger UI |
| `POST` | `/api/auth/login` | Publik | Login |
| `POST` | `/api/auth/refresh` | Publik | Refresh token |
| `POST` | `/api/auth/logout` | Login | Logout |
| `GET` | `/api/auth/me` | Login | Profil user aktif |
| `PUT` | `/api/auth/change-password` | Login | Ganti password |
| `GET` | `/api/books` | Publik | Daftar buku |
| `GET` | `/api/books/:id` | Publik | Detail buku |
| `POST` | `/api/books` | Admin | Tambah buku |
| `GET` | `/api/books/:id/download` | Login | Download PDF |
| `GET` | `/api/peminjaman` | Login | Riwayat peminjaman |
| `POST` | `/api/peminjaman` | Login | Pinjam buku |
| `POST` | `/api/peminjaman/verify-token` | Login | Verifikasi token baca |
| `PUT` | `/api/peminjaman/:id/kembalikan` | Admin | Proses pengembalian |
| `PUT` | `/api/peminjaman/:id/bayar-denda` | Admin | Tandai denda lunas |
| `GET` | `/api/skripsi` | Publik | Repositori karya ilmiah |
| `POST` | `/api/skripsi` | Login | Upload karya ilmiah |
| `GET` | `/api/jurnal` | Publik | Daftar jurnal |
| `GET` | `/api/fakultas` | Publik | Daftar fakultas & prodi |
| `GET` | `/api/settings` | Publik | Pengaturan sistem |
| `PUT` | `/api/settings` | Kepala | Update banyak setting |
| `GET` | `/api/laporan/statistik` | Admin | Statistik dashboard |
| `GET` | `/api/laporan/export/buku` | Admin | Export Excel koleksi |
| `GET` | `/api/laporan/export/peminjaman` | Admin | Export Excel peminjaman |
| `GET` | `/api/laporan/export/anggota` | Admin | Export Excel anggota |
| `GET` | `/api/log` | Kepala | Activity log |
| `GET` | `/api/bookmark` | Login | Bookmark saya |
| `POST` | `/api/bookmark/:bookId` | Login | Toggle bookmark |

Dokumentasi lengkap: **`/api/docs`** (Swagger UI)

---

## 🏗️ Struktur Project

```
digilib-backend-v3/
├── prisma/
│   ├── schema.prisma         ← 12 model MySQL
│   └── seed.js               ← Seed idempotent (upsert)
├── src/
│   ├── index.js              ← Entry point + createApp() untuk test
│   ├── config/
│   │   ├── env.js            ← Validasi environment + typed config
│   │   ├── logger.js         ← Winston + daily rotate (silent saat test)
│   │   └── swagger.js        ← OpenAPI 3.0 spec + semua schemas
│   ├── controllers/          ← 11 controller files
│   ├── routes/               ← 11 route files dengan Swagger JSDoc
│   ├── middleware/
│   │   ├── auth.middleware.js      ← JWT auth + role check
│   │   ├── requestId.middleware.js ← X-Request-Id (✅ BARU v3)
│   │   ├── validate.middleware.js  ← express-validator error handler
│   │   ├── upload.middleware.js    ← Multer PDF & image
│   │   ├── log.middleware.js       ← Activity log helper
│   │   └── error.middleware.js     ← Global error handler
│   ├── validations/
│   │   └── index.js               ← Semua rules + XSS sanitization
│   ├── jobs/
│   │   └── cron.jobs.js           ← Cron (skip saat NODE_ENV=test)
│   └── utils/
│       ├── prisma.js              ← Singleton + error translator
│       ├── token.js               ← JWT + token buku digital
│       └── response.js            ← Helper ok/fail/paginate/catchError
├── tests/
│   ├── setup/
│   │   ├── globalSetup.js         ← Load .env.test sebelum semua test
│   │   ├── globalTeardown.js      ← Tutup koneksi DB setelah test
│   │   ├── jest.setup.js          ← Setup per file test
│   │   └── testDb.js              ← seed/clean database test
│   └── integration/
│       ├── auth.test.js           ← 12 test cases auth
│       ├── books.test.js          ← 14 test cases buku
│       └── peminjaman.test.js     ← 11 test cases peminjaman
├── docker/
│   └── mysql/init.sql             ← Init script MySQL (sekali saja)
├── .env.example
├── .env.test                      ← Konfigurasi test database
├── Dockerfile                     ← Multi-stage, non-root
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Cron Jobs

| Waktu | Job |
|---|---|
| Setiap startup server | Catch-up status terlambat + hitung denda |
| Setiap hari 00:01 WIB | Update status "terlambat" + recalculate denda |
| Setiap hari 03:00 WIB | Hapus activity log > 90 hari |
| Setiap Minggu 02:00 WIB | Hapus refresh token expired |

> ⚠️ Cron **tidak aktif** saat `NODE_ENV=test`.

---

## 🔒 Arsitektur Keamanan

- **JWT dual-token**: access token 15 menit + refresh token 30 hari dengan rotation
- **Password hashing**: bcrypt 12 rounds
- **Rate limiting**: global 100 req/15 menit, login 10x/15 menit per IP
- **XSS protection**: semua input di-`trim().escape()` via express-validator
- **Anti enumeration**: pesan login identik untuk NIM salah & password salah
- **Session invalidation**: semua refresh token dihapus saat ganti/reset password
- **Request tracing**: setiap request memiliki `X-Request-Id` unik di header & log
- **Helmet**: security headers (CSP, HSTS, dll)
- **CORS**: whitelist origin dari environment variable
- **Non-root Docker**: container berjalan sebagai user `nodejs` (UID 1001)

---

## 📊 Role Access Matrix

| Endpoint Category | Kepala | Pustakawan | Mahasiswa | Umum | Publik |
|---|:---:|:---:|:---:|:---:|:---:|
| Books (baca) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Books (tulis) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Books (hapus) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Peminjaman (pinjam) | ✅ | ✅ | ✅ | ✅ | ❌ |
| Peminjaman (proses) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users (kelola) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Users (hapus) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Laporan & Export | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings (tulis) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Fakultas (tulis) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activity Log | ✅ | ❌ | ❌ | ❌ | ❌ |
