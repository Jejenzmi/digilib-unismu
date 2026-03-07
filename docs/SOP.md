# SOP & Workflow – Digilib UNISMU

> **Standar Operasional Prosedur (SOP) dan Alur Kerja**  
> Aplikasi Perpustakaan Digital Universitas Muslim Indonesia (UNISMU)

---

## Daftar Isi

1. [Peran & Hak Akses](#1-peran--hak-akses)
2. [SOP Pengguna (User)](#2-sop-pengguna-user)
   - 2.1 [Registrasi Akun](#21-registrasi-akun)
   - 2.2 [Login](#22-login)
   - 2.3 [Pencarian & Browsing Buku](#23-pencarian--browsing-buku)
   - 2.4 [Peminjaman Buku](#24-peminjaman-buku)
   - 2.5 [Perpanjangan Peminjaman](#25-perpanjangan-peminjaman)
   - 2.6 [Pengembalian Buku](#26-pengembalian-buku)
   - 2.7 [Denda Keterlambatan](#27-denda-keterlambatan)
   - 2.8 [Reservasi Buku (Antrean)](#28-reservasi-buku-antrean)
   - 2.9 [Ulasan & Penilaian Buku](#29-ulasan--penilaian-buku)
   - 2.10 [Wishlist (Daftar Keinginan)](#210-wishlist-daftar-keinginan)
   - 2.11 [Manajemen Profil](#211-manajemen-profil)
3. [SOP Administrator](#3-sop-administrator)
   - 3.1 [Manajemen Buku](#31-manajemen-buku)
   - 3.2 [Manajemen Kategori](#32-manajemen-kategori)
   - 3.3 [Manajemen Pengguna](#33-manajemen-pengguna)
   - 3.4 [Dashboard Statistik](#34-dashboard-statistik)
   - 3.5 [Manajemen Pengumuman](#35-manajemen-pengumuman)
4. [Workflow Lengkap](#4-workflow-lengkap)
   - 4.1 [Workflow Peminjaman & Pengembalian](#41-workflow-peminjaman--pengembalian)
   - 4.2 [Workflow Reservasi](#42-workflow-reservasi)
   - 4.3 [Workflow Ulasan Buku](#43-workflow-ulasan-buku)
   - 4.4 [Workflow Pengelolaan Buku oleh Admin](#44-workflow-pengelolaan-buku-oleh-admin)
5. [Kebijakan Sistem](#5-kebijakan-sistem)

---

## 1. Peran & Hak Akses

Sistem mendefinisikan tiga peran (role) dengan hak akses yang berbeda:

| Peran | Keterangan | Hak Akses |
|-------|-----------|-----------|
| **user** | Mahasiswa / anggota perpustakaan umum | Menjelajah katalog, meminjam, mengembalikan, memperpanjang, mereservasi, memberi ulasan, mengelola wishlist, mengubah profil sendiri |
| **admin** | Staf perpustakaan | Semua akses user + mengelola buku, kategori, pengguna, melihat statistik, membuat pengumuman |
| **kepala IT** | Kepala IT | Hak akses setara admin |

> Token JWT yang diterima setelah login menyimpan informasi peran dan berlaku selama **7 hari**.

---

## 2. SOP Pengguna (User)

### 2.1 Registrasi Akun

**Tujuan:** Membuat akun baru agar dapat menggunakan fitur peminjaman dan fitur lain yang memerlukan autentikasi.

**Langkah-langkah:**

1. Buka halaman **Daftar** (`/register`).
2. Isi formulir pendaftaran:
   - **Nama Lengkap** – wajib diisi
   - **Email** – wajib diisi, harus format email yang valid dan belum terdaftar
   - **Password** – minimal 8 karakter
3. Klik tombol **Daftar**.
4. Sistem memvalidasi data. Jika berhasil, akun langsung aktif dan pengguna diarahkan ke halaman login.

**Catatan:**
- Setiap email hanya dapat terdaftar satu kali.
- Password disimpan dalam bentuk ter-hash (bcrypt); tidak dapat dipulihkan, hanya dapat diubah melalui pengaturan profil.

---

### 2.2 Login

**Tujuan:** Mengautentikasi pengguna dan mendapatkan token akses.

**Langkah-langkah:**

1. Buka halaman **Login** (`/login`).
2. Masukkan **Email** dan **Password** yang terdaftar.
3. Klik tombol **Login**.
4. Jika berhasil, token JWT disimpan di sesi browser dan pengguna diarahkan ke halaman utama.
5. Navbar akan menampilkan nama pengguna beserta menu yang sesuai peran.

**Catatan:**
- Batas percobaan: 20 kali per 15 menit per alamat IP.
- Token berlaku selama 7 hari. Setelah habis masa berlaku, pengguna perlu login ulang.

---

### 2.3 Pencarian & Browsing Buku

**Tujuan:** Menemukan buku yang diinginkan dari katalog perpustakaan.

**Langkah-langkah:**

1. Buka halaman **Katalog Buku** (`/books`).
2. Gunakan fitur pencarian:
   - **Kotak pencarian** – masukkan judul, penulis, atau kata kunci.
   - **Filter kategori** – pilih kategori untuk mempersempit hasil.
3. Hasil ditampilkan dalam format daftar/grid beserta judul, penulis, kategori, dan stok tersedia.
4. Klik pada buku untuk melihat **Detail Buku** (`/books/:id`), yang mencakup:
   - Informasi lengkap (penulis, penerbit, tahun, ISBN, deskripsi)
   - Cover buku dan tautan file PDF (jika tersedia)
   - Rata-rata rating dan daftar ulasan pembaca
   - Status ketersediaan serta tombol Pinjam / Reservasi

---

### 2.4 Peminjaman Buku

**Tujuan:** Meminjam buku yang tersedia dari perpustakaan.

**Prasyarat:** Pengguna sudah login. Buku memiliki stok tersedia ≥ 1.

**Langkah-langkah:**

1. Buka halaman **Detail Buku**.
2. Pastikan status buku menunjukkan **"Tersedia"** (stok > 0).
3. Klik tombol **Pinjam**.
4. Sistem memvalidasi:
   - Pengguna belum meminjam buku yang sama dan belum dikembalikan.
   - Stok buku masih tersedia.
5. Jika berhasil:
   - Catatan peminjaman dibuat dengan **tanggal jatuh tempo 14 hari** dari tanggal pinjam.
   - Stok buku berkurang 1.
6. Status peminjaman dapat dipantau di halaman **Profil** (`/profile`) → tab **Riwayat Pinjam**.

**Catatan:**
- Batas permintaan: 30 kali per 15 menit per IP.
- Pengguna tidak dapat meminjam buku yang sama selama peminjaman aktif.

---

### 2.5 Perpanjangan Peminjaman

**Tujuan:** Memperpanjang batas waktu pengembalian buku.

**Prasyarat:** Status peminjaman `borrowed` (belum dikembalikan, belum melewati jatuh tempo), dan belum pernah diperpanjang sebelumnya.

**Langkah-langkah:**

1. Buka halaman **Profil** → tab **Riwayat Pinjam**.
2. Temukan buku yang ingin diperpanjang.
3. Klik tombol **Perpanjang**.
4. Sistem memeriksa:
   - `renewal_count < 1` (belum pernah diperpanjang)
   - Status masih `borrowed` (bukan `overdue`)
5. Jika berhasil, tanggal jatuh tempo diperpanjang **14 hari** dari tanggal jatuh tempo saat ini.

**Catatan:**
- Setiap peminjaman hanya boleh diperpanjang **satu kali**.
- Jika buku sudah overdue, perpanjangan tidak dapat dilakukan; buku harus segera dikembalikan.

---

### 2.6 Pengembalian Buku

**Tujuan:** Mengembalikan buku yang dipinjam ke perpustakaan.

**Langkah-langkah:**

1. Buka halaman **Profil** → tab **Riwayat Pinjam**.
2. Temukan buku yang ingin dikembalikan (status `borrowed` atau `overdue`).
3. Klik tombol **Kembalikan**.
4. Sistem akan:
   - Mencatat tanggal pengembalian.
   - Mengubah status peminjaman menjadi `returned`.
   - Menambah kembali stok buku sebesar 1.
   - Menghitung denda jika terlambat (lihat [2.7 Denda Keterlambatan](#27-denda-keterlambatan)).
   - Jika ada reservasi aktif untuk buku tersebut, status reservasi pertama diubah menjadi `available`.
5. Informasi denda ditampilkan dalam riwayat peminjaman.

---

### 2.7 Denda Keterlambatan

**Kebijakan:**

| Kondisi | Denda |
|---------|-------|
| Dikembalikan sebelum atau tepat jatuh tempo | Rp 0 |
| Dikembalikan setelah jatuh tempo | **Rp 1.000 per hari keterlambatan** |

**Cara menghitung:**
```
Denda = (tanggal_kembali - tanggal_jatuh_tempo) × Rp 1.000
```

Denda ditampilkan pada tab **Riwayat Pinjam** di halaman Profil. Pembayaran denda dilakukan secara mandiri kepada petugas perpustakaan di luar sistem ini.

---

### 2.8 Reservasi Buku (Antrean)

**Tujuan:** Mendaftarkan diri ke antrean agar dapat meminjam buku yang sedang habis stok.

**Prasyarat:** Buku memiliki stok 0. Pengguna sudah login dan belum mereservasi buku yang sama.

**Langkah-langkah:**

1. Buka halaman **Detail Buku**; tombol **Pinjam** tidak tersedia jika stok = 0.
2. Klik tombol **Reservasi**.
3. Sistem membuat catatan reservasi dengan status `pending`.
4. Ketika buku dikembalikan oleh peminjam lain, status reservasi pertama dalam antrean berubah menjadi `available`.
5. Pengguna dapat memantau status reservasi di **Profil** → tab **Reservasi**.
6. Ketika status menjadi `available`, pengguna dapat segera meminjam buku tersebut.

**Pembatalan Reservasi:**

1. Buka halaman **Profil** → tab **Reservasi**.
2. Klik tombol **Batalkan Reservasi** pada entri yang diinginkan.

---

### 2.9 Ulasan & Penilaian Buku

**Tujuan:** Memberikan ulasan dan rating untuk buku yang pernah dipinjam.

**Prasyarat:** Pengguna pernah meminjam buku tersebut (terdapat riwayat peminjaman).

**Langkah-langkah:**

1. Buka halaman **Detail Buku**.
2. Di bagian **Ulasan**, pilih rating bintang (1–5).
3. Tulis komentar (opsional).
4. Klik tombol **Kirim Ulasan**.
5. Ulasan ditampilkan di halaman Detail Buku beserta rata-rata rating.

**Catatan:**
- Setiap pengguna hanya dapat memberikan **satu ulasan per buku**. Pengiriman ulasan berikutnya akan memperbarui ulasan yang sudah ada.
- Pengguna dapat menghapus ulasan sendiri. Admin dapat menghapus ulasan siapa pun.

---

### 2.10 Wishlist (Daftar Keinginan)

**Tujuan:** Menyimpan daftar buku yang ingin dibaca atau dipinjam nanti.

**Langkah-langkah:**

**Menambahkan ke Wishlist:**
1. Buka halaman **Detail Buku**.
2. Klik ikon/tombol **Tambah ke Wishlist** (♡).
3. Buku tersimpan di daftar wishlist pengguna.

**Melihat Wishlist:**
1. Buka halaman **Profil** → tab **Wishlist**.
2. Daftar buku yang tersimpan ditampilkan beserta informasi stok terkini.

**Menghapus dari Wishlist:**
1. Di tab Wishlist, klik tombol **Hapus** pada buku yang diinginkan.
   **atau**
2. Kembali ke halaman **Detail Buku** dan klik ikon Wishlist untuk menghapus.

---

### 2.11 Manajemen Profil

**Tujuan:** Memperbarui informasi akun pribadi.

**Langkah-langkah:**

1. Buka halaman **Profil** (`/profile`).
2. Klik tombol **Edit Profil**.
3. Ubah data yang diinginkan:
   - **Nama Lengkap**
   - **Email** (harus belum digunakan akun lain)
   - **Password Baru** (minimal 8 karakter; kosongkan jika tidak ingin mengubah)
4. Klik **Simpan Perubahan**.
5. Jika email atau nama diubah, navbar akan diperbarui secara otomatis.

---

## 3. SOP Administrator

### 3.1 Manajemen Buku

**Tujuan:** Mengelola koleksi buku perpustakaan (tambah, ubah, hapus).

#### Menambahkan Buku Baru

1. Login dengan akun berperan **admin** atau **kepala IT**.
2. Buka **Dashboard Admin** (`/admin`) → tab **Buku**.
3. Klik tombol **Tambah Buku**.
4. Isi formulir:
   - **Judul** (wajib)
   - **Penulis** (wajib)
   - **ISBN** (opsional, harus unik)
   - **Kategori** (opsional)
   - **Deskripsi** (opsional)
   - **Penerbit** (opsional)
   - **Tahun Terbit** (opsional)
   - **Jumlah Eksemplar Tersedia** (wajib, ≥ 0)
   - **Cover Buku** – upload file gambar (JPEG/PNG/WebP/GIF, maks 20 MB)
   - **File Buku** – upload file PDF (maks 20 MB)
5. Klik **Simpan**.

#### Mengubah Data Buku

1. Di tab **Buku**, temukan buku yang akan diubah.
2. Klik tombol **Edit**.
3. Ubah data yang diperlukan (termasuk mengganti cover atau file PDF).
4. Klik **Simpan Perubahan**.

#### Menghapus Buku

1. Di tab **Buku**, temukan buku yang akan dihapus.
2. Klik tombol **Hapus**.
3. Konfirmasi penghapusan.
4. Sistem menghapus buku beserta file cover dan PDF terkait secara otomatis.

**Catatan:**
- File lama (cover/PDF) dihapus otomatis saat buku dihapus atau cover/file diganti.
- Buku yang memiliki riwayat peminjaman aktif tetap dapat dihapus (catatan peminjaman tetap tersimpan karena referensi buku diatur `ON DELETE CASCADE`).

---

### 3.2 Manajemen Kategori

**Tujuan:** Mengelola kategori untuk memudahkan klasifikasi dan pencarian buku.

#### Menambahkan Kategori

1. Buka **Dashboard Admin** → tab **Kategori**.
2. Klik **Tambah Kategori**.
3. Isi nama kategori (wajib, harus unik) dan deskripsi (opsional).
4. Klik **Simpan**.

#### Mengubah Kategori

1. Temukan kategori yang diinginkan, klik **Edit**.
2. Ubah nama atau deskripsi.
3. Klik **Simpan Perubahan**.

#### Menghapus Kategori

1. Temukan kategori yang diinginkan, klik **Hapus**.
2. **Catatan:** Kategori hanya dapat dihapus jika tidak ada buku yang menggunakan kategori tersebut. Jika masih ada buku, sistem akan menolak penghapusan.

---

### 3.3 Manajemen Pengguna

**Tujuan:** Memantau dan mengelola akun pengguna terdaftar.

#### Melihat Daftar Pengguna

1. Buka **Dashboard Admin** → tab **Pengguna**.
2. Daftar semua pengguna ditampilkan (ternpaginasi).

#### Melihat Riwayat Pinjam Semua Pengguna

1. Buka **Dashboard Admin** → tab **Peminjaman**.
2. Filter berdasarkan status (`borrowed`, `returned`, `overdue`) jika diperlukan.
3. Informasi mencakup: nama pengguna, judul buku, tanggal pinjam, jatuh tempo, tanggal kembali, status.

#### Menghapus Pengguna

1. Di tab **Pengguna**, temukan akun yang akan dihapus.
2. Klik tombol **Hapus**.
3. Admin tidak dapat menghapus akun dirinya sendiri.

---

### 3.4 Dashboard Statistik

**Tujuan:** Memantau kondisi dan performa perpustakaan secara keseluruhan.

**Cara akses:**

1. Buka **Dashboard Admin** → tab **Statistik**.

**Informasi yang tersedia:**

| Metrik | Keterangan |
|--------|-----------|
| Total Buku | Jumlah seluruh buku dalam koleksi |
| Total Kategori | Jumlah kategori yang tersedia |
| Total Pengguna | Jumlah akun terdaftar |
| Total Peminjaman | Jumlah seluruh catatan peminjaman |
| Peminjaman Aktif | Buku yang sedang dipinjam (status `borrowed`) |
| Peminjaman Terlambat | Buku yang melewati jatuh tempo (status `overdue`) |
| Buku Dikembalikan | Total buku yang sudah dikembalikan |
| Total Denda | Akumulasi denda seluruh peminjaman terlambat |
| Buku Terpopuler | 5 buku yang paling sering dipinjam |
| Tren Peminjaman | Grafik jumlah peminjaman per bulan (6 bulan terakhir) |

---

### 3.5 Manajemen Pengumuman

**Tujuan:** Menyampaikan informasi atau pengumuman kepada seluruh pengguna melalui halaman utama.

#### Membuat Pengumuman

1. Buka **Dashboard Admin** → tab **Pengumuman**.
2. Klik **Buat Pengumuman**.
3. Isi **Judul** dan **Isi** pengumuman.
4. Klik **Publikasikan**.
5. Pengumuman langsung tampil di halaman **Beranda** (`/`) untuk semua pengunjung.

#### Menghapus Pengumuman

1. Di tab **Pengumuman**, temukan pengumuman yang akan dihapus.
2. Klik tombol **Hapus**.

**Catatan:** Halaman Beranda hanya menampilkan **10 pengumuman terbaru**.

---

## 4. Workflow Lengkap

### 4.1 Workflow Peminjaman & Pengembalian

```
Pengguna
   │
   ├─► [Cari Buku] ──► Stok > 0? ──┬─ YA ──► [Klik Pinjam]
   │                                │              │
   │                                │         Validasi:
   │                                │         · Sudah login?
   │                                │         · Belum pinjam buku ini?
   │                                │              │
   │                                │         Berhasil ──► Buat catatan pinjam
   │                                │                      Due date = hari ini + 14 hari
   │                                │                      Stok buku -1
   │                                │
   │                                └─ TIDAK ──► [Reservasi] (lihat 4.2)
   │
   ├─► [Profil → Riwayat Pinjam]
   │
   ├─► [Perpanjang] ──► Syarat terpenuhi? ──► Due date + 14 hari
   │                    (belum diperpanjang,       renewal_count = 1
   │                     status borrowed)
   │
   └─► [Kembalikan] ──► Sistem mencatat return_date
                         Status ──► returned
                         Stok buku +1
                         Hitung denda (jika terlambat)
                         Notifikasi reservasi pertama ──► available
```

**Siklus Status Peminjaman:**

```
[borrowed] ──► (sebelum jatuh tempo) ──► [returned]
[borrowed] ──► (setelah jatuh tempo, otomatis) ──► [overdue] ──► [returned]
```

---

### 4.2 Workflow Reservasi

```
Stok Buku = 0
   │
   ▼
Pengguna klik [Reservasi]
   │
   ▼
Sistem buat reservasi (status: pending)
   │
   ▼
Pengguna menunggu...
   │
   ▼
Peminjam lain mengembalikan buku
   │
   ▼
Sistem cek: ada reservasi pending?
   ├─ YA ──► Status reservasi pertama ──► available
   │         Pengguna dapat notifikasi (tampil di Profil)
   │              │
   │              ▼
   │         Pengguna buka Detail Buku ──► Klik [Pinjam]
   │              │
   │              ▼
   │         Proses peminjaman normal
   │
   └─ TIDAK ──► Stok bertambah, tidak ada aksi khusus
```

**Status Reservasi:**

```
[pending] ──► (buku dikembalikan) ──► [available] ──► (pengguna meminjam / membatalkan)
[pending] ──► (pengguna batalkan) ──► [cancelled]
```

---

### 4.3 Workflow Ulasan Buku

```
Pengguna
   │
   ▼
Buka Detail Buku
   │
   ▼
Pernah meminjam buku ini?
   ├─ YA ──► Form ulasan tersedia
   │         Isi rating (1–5 bintang) + komentar
   │              │
   │              ▼
   │         Sudah pernah memberi ulasan?
   │         ├─ YA ──► Ulasan diperbarui (update)
   │         └─ TIDAK ──► Ulasan baru ditambahkan
   │              │
   │              ▼
   │         Ulasan & rata-rata rating diperbarui di halaman
   │
   └─ TIDAK ──► Form ulasan tidak tampil
                (hanya pembaca yang pernah meminjam dapat mengulas)
```

---

### 4.4 Workflow Pengelolaan Buku oleh Admin

```
Admin Login
   │
   ▼
Dashboard Admin (/admin)
   │
   ├─► Tab Buku
   │      │
   │      ├─► [Tambah Buku]
   │      │      └─► Isi form + upload cover & PDF ──► Simpan
   │      │
   │      ├─► [Edit Buku]
   │      │      └─► Ubah data / ganti file ──► Simpan
   │      │          (file lama otomatis dihapus)
   │      │
   │      └─► [Hapus Buku]
   │             └─► Konfirmasi ──► Buku & file terhapus
   │
   ├─► Tab Kategori
   │      ├─► Tambah / Edit / Hapus kategori
   │      └─► (Hapus hanya jika tidak ada buku dalam kategori)
   │
   ├─► Tab Pengguna
   │      ├─► Lihat daftar pengguna
   │      └─► Hapus pengguna (tidak bisa hapus akun sendiri)
   │
   ├─► Tab Peminjaman
   │      └─► Pantau semua peminjaman, filter status
   │
   ├─► Tab Statistik
   │      └─► Lihat ringkasan & analitik perpustakaan
   │
   └─► Tab Pengumuman
          ├─► Buat pengumuman baru
          └─► Hapus pengumuman lama
```

---

## 5. Kebijakan Sistem

| Kebijakan | Nilai |
|-----------|-------|
| Durasi peminjaman standar | 14 hari |
| Maksimal perpanjangan | 1 kali |
| Durasi perpanjangan | +14 hari dari jatuh tempo saat ini |
| Denda keterlambatan | Rp 1.000 per hari |
| Satu buku per pengguna | Pengguna tidak dapat meminjam buku yang sama lebih dari satu kali secara bersamaan |
| Satu ulasan per buku per pengguna | Ulasan dapat diperbarui, tidak duplikasi |
| Ukuran file maksimal | 20 MB (cover & PDF) |
| Format cover yang diterima | JPEG, PNG, WebP, GIF |
| Format file buku yang diterima | PDF |
| Token JWT berlaku | 7 hari |
| Rate limit login/registrasi | 20 permintaan / 15 menit per IP |
| Rate limit pinjam/kembali/reservasi | 30 permintaan / 15 menit per IP |
| Rate limit API umum | 200 permintaan / 15 menit per IP |
| Pengumuman tampil di Beranda | 10 terbaru |

---

*Dokumen ini mencerminkan kondisi sistem per versi terkini. Hubungi administrator untuk pertanyaan lebih lanjut.*
