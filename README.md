# Digilib UNISMU – Perpustakaan Digital

Aplikasi perpustakaan digital Universitas Muslim Indonesia (UNISMU), dibangun dengan **React + Vite** (frontend) dan **Node.js + Express** (backend).

---

## Fitur

- 📚 Katalog buku dengan pencarian dan filter kategori
- 🔐 Autentikasi pengguna (JWT) – registrasi & login
- 📖 Peminjaman & pengembalian buku
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

**Akun bawaan setelah seeding:**

| Role  | Email                       | Password  |
|-------|-----------------------------|-----------|
| Admin | admin@unismu.ac.id          | admin123  |
| User  | mahasiswa@unismu.ac.id      | user123   |

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
| Method | Endpoint                  | Akses       |
|--------|---------------------------|-------------|
| GET    | /api/books                | Publik      |
| GET    | /api/books/:id            | Publik      |
| POST   | /api/books                | Admin       |
| PUT    | /api/books/:id            | Admin       |
| DELETE | /api/books/:id            | Admin       |
| POST   | /api/books/:id/borrow     | User login  |
| POST   | /api/books/:id/return     | User login  |

### Kategori
| Method | Endpoint              | Akses  |
|--------|-----------------------|--------|
| GET    | /api/categories       | Publik |
| POST   | /api/categories       | Admin  |
| PUT    | /api/categories/:id   | Admin  |
| DELETE | /api/categories/:id   | Admin  |

### Pengguna
| Method | Endpoint              | Akses  |
|--------|-----------------------|--------|
| GET    | /api/users/me         | Login  |
| PUT    | /api/users/me         | Login  |
| GET    | /api/users/me/borrows | Login  |
| GET    | /api/users            | Admin  |
| DELETE | /api/users/:id        | Admin  |
| GET    | /api/users/borrows    | Admin  |

