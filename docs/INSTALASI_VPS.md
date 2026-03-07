# Panduan Instalasi di VPS Rumah Web

> Panduan langkah demi langkah untuk men-deploy **Digilib UNISMU** di VPS dari Rumah Web menggunakan terminal SSH.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Masuk ke VPS via SSH](#2-masuk-ke-vps-via-ssh)
3. [Update Server & Install Dependensi Dasar](#3-update-server--install-dependensi-dasar)
4. [Install Node.js](#4-install-nodejs)
5. [Install PostgreSQL](#5-install-postgresql)
6. [Setup Database](#6-setup-database)
7. [Clone Repositori & Konfigurasi Aplikasi](#7-clone-repositori--konfigurasi-aplikasi)
8. [Build Frontend](#8-build-frontend)
9. [Jalankan Backend dengan PM2](#9-jalankan-backend-dengan-pm2)
10. [Install & Konfigurasi Nginx](#10-install--konfigurasi-nginx)
11. [Aktifkan SSL/HTTPS dengan Certbot](#11-aktifkan-sslhttps-dengan-certbot)
12. [Verifikasi Deployment](#12-verifikasi-deployment)
13. [Perintah Berguna setelah Deploy](#13-perintah-berguna-setelah-deploy)

---

## 1. Prasyarat

Sebelum memulai, pastikan Anda sudah memiliki:

- **VPS aktif** dari Rumah Web (disarankan Ubuntu 22.04 LTS)
- **Domain** yang sudah diarahkan (DNS A record) ke IP VPS
- **Kredensial SSH** VPS (IP, username, dan password atau SSH key) – tersedia di panel kontrol Rumah Web
- Akses ke **panel kontrol Rumah Web** untuk mengatur DNS jika diperlukan

---

## 2. Masuk ke VPS via SSH

Buka terminal di komputer lokal Anda (atau gunakan fitur **SSH Console** di panel Rumah Web), lalu jalankan:

```bash
ssh root@IP_VPS_ANDA
```

Ganti `IP_VPS_ANDA` dengan alamat IP VPS yang tertera di panel Rumah Web. Masukkan password saat diminta.

> **Tips:** Jika Anda menggunakan Windows, gunakan aplikasi **PuTTY** atau terminal bawaan Windows 11 (Windows Terminal).

---

## 3. Update Server & Install Dependensi Dasar

Setelah berhasil masuk, update sistem dan install paket yang dibutuhkan:

```bash
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw
```

---

## 4. Install Node.js

Aplikasi ini membutuhkan Node.js versi 18 atau lebih baru. Gunakan **NodeSource** untuk instalasi:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verifikasi instalasi:

```bash
node -v    # Harus menampilkan v20.x.x atau lebih baru
npm -v     # Harus menampilkan 9.x.x atau lebih baru
```

Install **PM2** (process manager untuk Node.js) secara global:

```bash
npm install -g pm2
```

---

## 5. Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

Aktifkan dan jalankan PostgreSQL:

```bash
systemctl enable postgresql
systemctl start postgresql
```

---

## 6. Setup Database

### 6.1 Buat User & Database PostgreSQL

Masuk ke shell PostgreSQL sebagai user `postgres`:

```bash
sudo -u postgres psql
```

Di dalam shell PostgreSQL, jalankan perintah berikut (ganti `PASSWORD_AMAN` dengan password pilihan Anda):

```sql
CREATE USER digilib_user WITH PASSWORD 'PASSWORD_AMAN';
CREATE DATABASE digilib_unismu OWNER digilib_user;
GRANT ALL PRIVILEGES ON DATABASE digilib_unismu TO digilib_user;
\q
```

### 6.2 Catat Database URL

Simpan string koneksi berikut untuk digunakan di langkah berikutnya:

```
postgresql://digilib_user:PASSWORD_AMAN@localhost:5432/digilib_unismu
```

---

## 7. Clone Repositori & Konfigurasi Aplikasi

### 7.1 Clone Repositori

```bash
cd /var/www
git clone https://github.com/Jejenzmi/digilib-unismu.git
cd digilib-unismu
```

### 7.2 Install Dependensi Frontend

```bash
npm install
```

### 7.3 Install Dependensi Backend

```bash
cd backend
npm install
```

### 7.4 Buat File Konfigurasi Backend (`.env`)

Masih di dalam folder `backend/`, buat file `.env` dari template:

```bash
cp .env.example .env
nano .env
```

Isi file `.env` dengan konfigurasi yang sesuai. Tekan `Ctrl+X`, lalu `Y`, lalu `Enter` untuk menyimpan:

```env
PORT=5000
JWT_SECRET=ISI_DENGAN_STRING_ACAK_MINIMAL_32_KARAKTER
JWT_EXPIRES_IN=7d
NODE_ENV=production
DATABASE_URL=postgresql://digilib_user:PASSWORD_AMAN@localhost:5432/digilib_unismu
CORS_ORIGIN=https://DOMAIN_ANDA
```

> **Cara membuat `JWT_SECRET` yang kuat:**
> ```bash
> openssl rand -base64 32
> ```
> Salin output perintah di atas dan tempel sebagai nilai `JWT_SECRET`.

### 7.5 Inisialisasi Skema Database

Jalankan perintah berikut untuk membuat tabel-tabel yang diperlukan:

```bash
node -e "require('./database/db.js')"
```

> ⚠️ **Jangan jalankan `npm run seed` di environment production.** Perintah seed hanya untuk keperluan pengembangan dan akan membuat akun dengan password lemah.

Kembali ke folder root project:

```bash
cd ..
```

---

## 8. Build Frontend

Buat file konfigurasi frontend lalu build:

```bash
cp .env.example .env.local
nano .env.local
```

Isi file `.env.local`:

```env
VITE_API_URL=https://DOMAIN_ANDA/api
```

Simpan file (`Ctrl+X`, `Y`, `Enter`), kemudian jalankan build:

```bash
npm run build
```

Hasil build akan tersimpan di folder `dist/`.

---

## 9. Jalankan Backend dengan PM2

Masuk ke folder backend dan jalankan server dengan PM2:

```bash
cd /var/www/digilib-unismu/backend
pm2 start server.js --name "digilib-backend"
```

Simpan konfigurasi PM2 agar backend otomatis berjalan saat VPS restart:

```bash
pm2 save
pm2 startup
```

Ikuti instruksi yang muncul dari perintah `pm2 startup` (biasanya perlu menjalankan satu perintah tambahan dengan `sudo`).

Verifikasi backend berjalan:

```bash
pm2 status
pm2 logs digilib-backend --lines 20
```

---

## 10. Install & Konfigurasi Nginx

Nginx berfungsi sebagai reverse proxy yang mengarahkan traffic HTTP/HTTPS ke backend Node.js dan menyajikan file frontend yang sudah di-build.

### 10.1 Buat Konfigurasi Virtual Host Nginx

```bash
nano /etc/nginx/sites-available/digilib-unismu
```

Tempel konfigurasi berikut (ganti `DOMAIN_ANDA` dengan nama domain Anda):

```nginx
server {
    listen 80;
    server_name DOMAIN_ANDA www.DOMAIN_ANDA;

    # Sajikan file frontend (hasil build React)
    root /var/www/digilib-unismu/dist;
    index index.html;

    # Proxy request API ke backend Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy request upload ke backend Node.js
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Fallback ke index.html untuk client-side routing (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Simpan file (`Ctrl+X`, `Y`, `Enter`).

### 10.2 Aktifkan Konfigurasi & Restart Nginx

```bash
ln -s /etc/nginx/sites-available/digilib-unismu /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 10.3 Konfigurasi Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 11. Aktifkan SSL/HTTPS dengan Certbot

Pastikan domain Anda sudah diarahkan ke IP VPS (bisa dicek dengan `ping DOMAIN_ANDA`), kemudian jalankan:

```bash
certbot --nginx -d DOMAIN_ANDA -d www.DOMAIN_ANDA
```

Ikuti petunjuk interaktif:
1. Masukkan alamat email untuk notifikasi keamanan
2. Setujui syarat penggunaan (ketik `A`)
3. Pilih apakah ingin berbagi email dengan EFF (opsional)
4. Pilih opsi redirect HTTP ke HTTPS (ketik `2`, direkomendasikan)

Certbot akan otomatis memperbarui sertifikat SSL. Verifikasi pembaruan otomatis:

```bash
certbot renew --dry-run
```

---

## 12. Verifikasi Deployment

Buka browser dan akses domain Anda:

1. **Halaman utama** – `https://DOMAIN_ANDA` → harus menampilkan halaman beranda Digilib UNISMU
2. **Health check API** – `https://DOMAIN_ANDA/api/health` → harus mengembalikan `{"status":"ok"}`
3. **Login** – coba login dengan akun yang telah dibuat
4. **Upload** – coba tambah buku dengan cover untuk memastikan folder `uploads/` berfungsi

---

## 13. Perintah Berguna setelah Deploy

### Memonitor Backend

```bash
pm2 status                        # Lihat status semua proses PM2
pm2 logs digilib-backend          # Lihat log backend secara real-time
pm2 logs digilib-backend --lines 100  # Lihat 100 baris log terakhir
```

### Restart Backend

```bash
pm2 restart digilib-backend
```

### Update Aplikasi (saat ada versi baru)

```bash
cd /var/www/digilib-unismu

# Tarik perubahan terbaru
git pull origin main

# Update dependensi jika ada perubahan
npm install
cd backend && npm install && cd ..

# Build ulang frontend
npm run build

# Restart backend
pm2 restart digilib-backend

# Reload Nginx (jika ada perubahan konfigurasi)
systemctl reload nginx
```

### Melihat Log Nginx

```bash
tail -f /var/log/nginx/error.log    # Log error
tail -f /var/log/nginx/access.log   # Log akses
```

### Backup Database

```bash
sudo -u postgres pg_dump digilib_unismu > /root/backup_digilib_$(date +%Y%m%d).sql
```

---

*Untuk pertanyaan terkait SOP dan alur kerja aplikasi, lihat [docs/SOP.md](SOP.md).*
