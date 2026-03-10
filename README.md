# 📚 Digilib UNISMU
### Sistem Perpustakaan Digital — Universitas Islam Dr. Khez Muttaqien

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://reactjs.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)](https://mysql.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.10-purple)](https://prisma.io)

---

## 🗂 Struktur Proyek

```
digilib-unismu/
├── backend/           ← Node.js + Express + Prisma + MySQL
│   ├── src/
│   │   ├── controllers/   (11 controller)
│   │   ├── routes/        (11 route + Swagger)
│   │   ├── middleware/    (auth, upload, log, validate, error)
│   │   ├── jobs/          (cron harian)
│   │   └── utils/
│   ├── prisma/
│   │   ├── schema.prisma  (11 model)
│   │   └── seed.js        (data awal)
│   ├── Dockerfile
│   └── .env.example
├── frontend/          ← React 18 + Vite
│   ├── src/
│   │   ├── App.jsx        (seluruh UI ~1900 baris)
│   │   ├── main.jsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml ← Jalankan semua sekaligus
├── .env.example
└── README.md
```

---

## 🚀 Cara Deploy (Docker — Recommended)

### Prasyarat
- Docker & Docker Compose terinstall
- Port 3000, 5000, 3306 tersedia

### Langkah

```bash
# 1. Clone / ekstrak project
cd digilib-unismu

# 2. Buat file .env dari template
cp .env.example .env

# 3. Edit .env — WAJIB isi JWT_SECRET dan JWT_REFRESH_SECRET
#    Generate secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Jalankan semua service
docker compose up -d --build

# 5. Cek status
docker compose ps
docker compose logs -f api

# 6. Buka browser
# Frontend : http://localhost:3000
# API Docs : http://localhost:5000/api/docs
```

### Hentikan / Reset

```bash
# Hentikan
docker compose down

# Hapus semua data (termasuk database)
docker compose down -v
```

---

## 💻 Cara Jalankan Manual (Tanpa Docker)

### Backend

```bash
cd backend

# Install dependencies
npm install

# Buat file .env
cp .env.example .env
# Edit .env: isi DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET

# Sinkron schema database
npx prisma db push

# Seed data awal (akun default, settings)
node prisma/seed.js

# Jalankan development
npm run dev

# Atau production
npm start
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Buat file .env
cp .env.example .env
# Edit VITE_API_URL jika backend bukan di localhost:5000

# Development
npm run dev
# → http://localhost:3000

# Build production
npm run build
npm run preview
```

---

## 🔑 Akun Default (Seed)

| Role | NIM / ID | Password |
|---|---|---|
| Kepala Perpustakaan | `KP001` | `Admin@UNISMU2024` |
| Pustakawan | `PUS001` | `Pustaka@123` |
| Mahasiswa | `2021001001` | `Mahasiswa@123` |
| Dosen/Umum | `DSN001` | `Dosen@123` |

---

## 📡 API Endpoints Utama

| Modul | Base URL |
|---|---|
| Autentikasi | `POST /api/auth/login` |
| Buku | `GET/POST/PUT/DELETE /api/books` |
| Upload PDF | `POST /api/books` (multipart/form-data) |
| Baca PDF | `GET /api/books/:id/download` |
| Peminjaman | `GET/POST /api/peminjaman` |
| Pengguna | `GET/POST/PUT/DELETE /api/users` |
| Laporan | `GET /api/laporan/statistik` |
| Pengaturan | `GET/PUT /api/settings` |
| Swagger UI | `GET /api/docs` |

---

## ✨ Fitur Utama

### Umum
- 🔐 Login JWT dengan auto-refresh token
- 👁 Toggle show/hide password
- 🔔 Notifikasi toast (sukses/error)
- 💬 Dialog konfirmasi Simpan/Update/Hapus (bukan browser alert)

### Buku & Ebook
- 📚 Katalog publik tanpa login
- ➕ Tambah buku + upload PDF ebook
- ✏️ Edit buku + ganti file PDF
- 🗑 Hapus buku (soft delete, cek peminjaman aktif)
- 📖 PDF Reader built-in (baca di browser, tidak perlu download)
- 🔑 Sistem token akses untuk meminjam & membaca

### Peminjaman
- 📋 Peminjaman dengan token unik (UNISMU-userId-bookId-expiry-checksum)
- ⏰ Deteksi otomatis keterlambatan (cron harian)
- 💰 Kalkulasi denda otomatis
- ✅ Konfirmasi pengembalian

### Admin
- 👥 Manajemen pengguna lengkap
- 🏛 Manajemen Fakultas & Program Studi
- 📰 Manajemen Jurnal Ilmiah
- 📊 Laporan & statistik + export Excel
- ⚙️ Pengaturan sistem (denda, durasi pinjam, banner, kategori)
- 📋 Activity log

---

## 🗄 Struktur Database (12 Model)

`User` · `Book` · `Peminjaman` · `RefreshToken` · `Bookmark` · `Fakultas` · `Prodi` · `Setting` · `ActivityLog` · `Jurnal` · `Skripsi`

---

## 🛠 Stack Teknologi

**Backend:** Node.js 20 · Express.js · Prisma ORM · MySQL 8 · JWT · Multer · Winston · node-cron · Swagger

**Frontend:** React 18 · Vite 5 · Vanilla CSS (zero dependency UI)

**Infrastructure:** Docker · Docker Compose · Nginx (serve frontend)

---

## 📁 Upload File

File PDF ebook disimpan di `backend/uploads/books/`.
Dalam Docker: volume `uploads_data` (persisten lintas restart).

Batas ukuran default: **50 MB** per file (ubah `MAX_FILE_SIZE_MB` di `.env`).

---

## 🔒 Keamanan

- Password di-hash bcrypt (saltRounds=12)
- JWT access token (1 jam) + refresh token (7 hari)
- Token tersimpan di `localStorage` — tetap login walau browser ditutup
- Helmet.js headers
- Rate limiting (login: 5 req/15 menit)
- Magic bytes validation untuk upload PDF
- IDOR protection pada endpoint sensitif
- Soft delete (data tidak hilang permanen)

---

*Digilib UNISMU v6.0 — Backend v3.3 · Frontend v6*
