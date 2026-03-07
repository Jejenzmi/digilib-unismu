# Digilib UNISMU – Perpustakaan Digital

Aplikasi perpustakaan digital Universitas Muslim Indonesia (UNISMU), dibangun dengan **React + Vite** (frontend) dan **Node.js + Express** (backend).

---

## Fitur

- 📚 Katalog buku dengan pencarian dan filter kategori
- 🔐 Autentikasi pengguna (JWT) – registrasi & login
- 📖 Peminjaman & pengembalian buku (durasi 14 hari)
- 🔄 Perpanjangan peminjaman (1 kali, +14 hari)
- ⏳ Reservasi buku (sistem antrean jika stok habis)
- 💰 Perhitungan denda otomatis (Rp 1.000/hari keterlambatan)
- ⭐ Ulasan & penilaian buku (1–5 bintang, khusus peminjam)
- ❤️ Wishlist / daftar keinginan per pengguna
- 📣 Pengumuman perpustakaan oleh admin
- 📊 Dashboard statistik & analitik untuk admin
- 🛠️ Dashboard admin – manajemen buku, kategori, dan pengguna
- 📁 Upload cover buku dan file PDF
- 🗄️ Database PostgreSQL

---

## Teknologi

| Layer    | Teknologi                              |
|----------|----------------------------------------|
| Frontend | React 19, React Router v7, Axios, Vite |
| Backend  | Node.js, Express 4, pg (PostgreSQL)    |
| Auth     | JWT (jsonwebtoken), bcryptjs           |
| Upload   | Multer 2                               |

---

## Prasyarat

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL ≥ 14

---

## Cara Menjalankan

### 1. Backend

```bash
cd backend
npm install

# Salin file konfigurasi dan sesuaikan nilainya
cp .env.example .env

# Isi database dengan data awal (opsional)
npm run seed

# Jalankan server (production)
npm start

# Jalankan server (development dengan auto-reload)
npm run dev
```

Server berjalan di **http://localhost:5000**

**Akun bawaan setelah seeding (hanya untuk development):**

| Role  | Email                       | Password  |
|-------|-----------------------------|-----------|
| Admin | admin@unismu.ac.id          | admin123  |
| User  | mahasiswa@unismu.ac.id      | user123   |

> ⚠️ **Jangan jalankan `npm run seed` di lingkungan production.** Akun-akun di atas menggunakan password yang lemah dan bersifat publik. Jika seed sudah pernah dijalankan di production, segera ganti password semua akun tersebut dari dashboard admin.

### 2. Frontend

```bash
# Di root project
npm install
npm run dev
```

Aplikasi berjalan di **http://localhost:5173**

---

## Konfigurasi Environment (Backend)

Buat file `backend/.env` berdasarkan `backend/.env.example`:

```env
PORT=5000
JWT_SECRET=ganti_dengan_secret_yang_kuat
JWT_EXPIRES_IN=7d
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/digilib_unismu
```

## Konfigurasi Environment (Frontend)

Buat file `.env.local` di root berdasarkan `.env.example` untuk mengubah URL API (opsional saat development):

```env
VITE_API_URL=http://localhost:5000/api
```

> Saat development, Vite secara otomatis memproxy request `/api` dan `/uploads` ke backend (`http://localhost:5000`), sehingga variabel ini tidak wajib diisi.

---

## Struktur Proyek

```
digilib-unismu/
├── src/                    # Frontend React
│   ├── api/                # Axios instance
│   ├── components/         # Komponen (Navbar, ProtectedRoute)
│   ├── context/            # AuthContext (JWT state)
│   └── pages/              # Home, Books, BookDetail, Login, Register, Profile, Admin
├── backend/                # Backend Node.js
│   ├── database/           # db.js (schema), seed.js (data awal)
│   ├── middleware/         # auth.js (JWT middleware)
│   ├── routes/             # auth, books, categories, users
│   ├── uploads/            # cover & file uploads
│   └── server.js           # Entry point Express
└── README.md
```

---

## API Endpoints

### Auth
| Method | Endpoint              | Deskripsi        |
|--------|-----------------------|------------------|
| POST   | /api/auth/register    | Daftar akun baru |
| POST   | /api/auth/login       | Login            |

### Buku
| Method | Endpoint                      | Akses                      |
|--------|-------------------------------|----------------------------|
| GET    | /api/books                    | Publik                     |
| GET    | /api/books/:id                | Publik                     |
| POST   | /api/books                    | Admin                      |
| PUT    | /api/books/:id                | Admin                      |
| DELETE | /api/books/:id                | Admin                      |
| POST   | /api/books/:id/borrow         | User login                 |
| POST   | /api/books/:id/return         | User login                 |
| POST   | /api/books/:id/renew          | User login                 |
| POST   | /api/books/:id/reserve        | User login                 |
| DELETE | /api/books/:id/reserve        | User login                 |
| GET    | /api/books/:id/reviews        | Publik                     |
| POST   | /api/books/:id/reviews        | User login (pernah pinjam) |
| DELETE | /api/books/:id/reviews/:revId | Pemilik ulasan / Admin     |
| POST   | /api/books/:id/wishlist       | User login                 |
| DELETE | /api/books/:id/wishlist       | User login                 |

### Kategori
| Method | Endpoint              | Akses  |
|--------|-----------------------|--------|
| GET    | /api/categories       | Publik |
| GET    | /api/categories/:id   | Publik |
| POST   | /api/categories       | Admin  |
| PUT    | /api/categories/:id   | Admin  |
| DELETE | /api/categories/:id   | Admin  |

### Pengguna
| Method | Endpoint                   | Akses  |
|--------|----------------------------|--------|
| GET    | /api/users/me              | Login  |
| PUT    | /api/users/me              | Login  |
| GET    | /api/users/me/borrows      | Login  |
| GET    | /api/users/me/reservations | Login  |
| GET    | /api/users/me/wishlist     | Login  |
| GET    | /api/users                 | Admin  |
| DELETE | /api/users/:id             | Admin  |
| GET    | /api/users/borrows         | Admin  |

### Statistik
| Method | Endpoint    | Akses |
|--------|-------------|-------|
| GET    | /api/stats  | Admin |

### Pengumuman
| Method | Endpoint               | Akses  |
|--------|------------------------|--------|
| GET    | /api/announcements     | Publik |
| POST   | /api/announcements     | Admin  |
| DELETE | /api/announcements/:id | Admin  |

---

## Instalasi di VPS (Rumah Web)

Untuk panduan lengkap men-deploy aplikasi ini di VPS Rumah Web melalui terminal SSH, lihat:

🖥️ **[docs/INSTALASI_VPS.md](docs/INSTALASI_VPS.md)**

Panduan tersebut mencakup:
- Koneksi SSH ke VPS Rumah Web
- Instalasi Node.js, PostgreSQL, PM2, dan Nginx
- Konfigurasi database dan environment
- Build frontend dan deploy backend
- Aktivasi SSL/HTTPS dengan Certbot
- Perintah-perintah berguna pasca-deploy

---

## SOP & Workflow

Untuk panduan lengkap alur kerja dan Standar Operasional Prosedur (SOP) aplikasi, lihat:

📄 **[docs/SOP.md](docs/SOP.md)**

Dokumen tersebut mencakup:
- SOP untuk pengguna (registrasi, login, pinjam, kembali, perpanjangan, reservasi, ulasan, wishlist, profil)
- SOP untuk administrator (kelola buku, kategori, pengguna, statistik, pengumuman)
- Diagram workflow lengkap untuk setiap proses utama
- Kebijakan sistem (durasi pinjam, denda, batas file, dll.)


---

## Checklist Production Deployment

Sebelum go-live, pastikan semua item berikut sudah terpenuhi:

### Konfigurasi Wajib
- [ ] `JWT_SECRET` diisi dengan string acak minimal 32 karakter (`openssl rand -base64 32`)
- [ ] `NODE_ENV=production` diatur di file `.env`
- [ ] `DATABASE_URL` mengarah ke database production (bukan localhost)
- [ ] `CORS_ORIGIN` diisi dengan domain production (mis. `https://digilib.unismu.ac.id`)
- [ ] File `.env` **tidak** di-commit ke repository (sudah ada di `.gitignore`)

### Keamanan
- [ ] **Jangan** jalankan `npm run seed` di production
- [ ] Jika seed pernah dijalankan, ganti password akun `admin@unismu.ac.id` dan akun lainnya
- [ ] Aktifkan SSL/TLS (HTTPS) untuk semua koneksi
- [ ] Pastikan folder `uploads/` tidak dapat di-list secara publik (directory listing dinonaktifkan)

### Build & Deploy
- [ ] Jalankan `npm run build` di root project untuk membangun frontend
- [ ] Jalankan `npm start` di folder `backend/` untuk menjalankan server production
- [ ] Pastikan proses Node.js dijalankan melalui process manager (mis. PM2, systemd)

### Pasca-Deploy
- [ ] Periksa endpoint `/api/health` mengembalikan `{ "status": "ok" }`
- [ ] Login sebagai admin dan verifikasi semua fitur berjalan normal
- [ ] Atur backup rutin untuk database PostgreSQL
