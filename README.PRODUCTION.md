# 🚀 Panduan Deploy Production — Digilib UNISMU

## Arsitektur Production

```
Internet
   │
   ▼
[Nginx :80/:443]  ← reverse proxy + SSL termination
   ├── /api/*    → [Backend API :5000]  → [MySQL :3306]
   │                     │                      │
   │               [MinIO :9000]         [Backup Service]
   └── /*        → [Frontend :80]
```

---

## 1. Prasyarat Server

```bash
# Install Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo apt install docker-compose-plugin -y
sudo usermod -aG docker $USER && newgrp docker

# Verify
docker --version           # Docker 24+
docker compose version     # v2.20+
```

---

## 2. Setup Awal

```bash
# Clone / upload project
unzip digilib-unismu-deploy-v10.zip
cd digilib-deploy

# Salin dan edit environment
cp .env.example .env
nano .env
```

**Wajib diubah di `.env`:**
```env
MYSQL_PASSWORD=password_db_yang_kuat_2024
MYSQL_ROOT_PASSWORD=root_password_yang_kuat_2024
JWT_SECRET=<output dari: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_REFRESH_SECRET=<output dari perintah yang sama, nilai berbeda>
MINIO_SECRET_KEY=minio_secret_yang_kuat_2024
```

---

## 3. Deploy Development / Internal

```bash
# Tanpa Nginx, MinIO, Backup (mode dasar)
docker compose up -d --build

# Cek status
docker compose ps

# Lihat log
docker compose logs -f

# Akses
# Frontend: http://localhost:3000
# API Docs: http://localhost:5000/api/docs
```

---

## 4. Deploy Production Lengkap

```bash
# Dengan Nginx + MinIO + Backup
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# MinIO Console: http://localhost:9001
# (login dengan MINIO_ACCESS_KEY dan MINIO_SECRET_KEY dari .env)
```

---

## 5. Setup HTTPS dengan Let's Encrypt

### Langkah 1 — DNS
Pastikan domain Anda (misal: `digilib.unismu.ac.id`) sudah mengarah ke IP server:
```bash
dig digilib.unismu.ac.id   # harus menampilkan IP server
```

### Langkah 2 — Edit nginx config
```bash
# Ganti DOMAIN_ANDA di file HTTP config
sed -i 's/DOMAIN_ANDA/digilib.unismu.ac.id/g' nginx/conf.d/digilib.conf

# Restart nginx agar Certbot bisa verifikasi
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### Langkah 3 — Dapatkan sertifikat
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  -w /var/www/certbot \
  -d digilib.unismu.ac.id \
  --email admin@unismu.ac.id \
  --agree-tos \
  --no-eff-email
```

### Langkah 4 — Aktifkan HTTPS config
```bash
# Edit DOMAIN_ANDA di HTTPS config
sed -i 's/DOMAIN_ANDA/digilib.unismu.ac.id/g' nginx/conf.d/digilib.https.conf

# Ganti config HTTP → HTTPS
cp nginx/conf.d/digilib.https.conf nginx/conf.d/digilib.conf

# Restart nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### Langkah 5 — Update VITE_API_URL di .env
```env
FRONTEND_URL=https://digilib.unismu.ac.id
VITE_API_URL=https://digilib.unismu.ac.id/api
```

```bash
# Rebuild frontend dengan URL baru
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build frontend
```

### Auto-renew sertifikat
Certbot container sudah dikonfigurasi untuk auto-renew setiap 12 jam.
Cek status: `docker compose logs certbot`

---

## 6. Konfigurasi SMTP Email

Edit `.env`:
```env
# Gmail (aktifkan 2FA dulu, lalu buat App Password di Google Account)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=perpustakaan@gmail.com
SMTP_PASS=xxxx_xxxx_xxxx_xxxx   # App Password dari Google
SMTP_FROM=Perpustakaan UNISMU <perpustakaan@gmail.com>

# Atau Mailtrap untuk testing
# SMTP_HOST=sandbox.smtp.mailtrap.io
# SMTP_PORT=2525
# SMTP_USER=<dari dashboard mailtrap>
# SMTP_PASS=<dari dashboard mailtrap>
```

```bash
# Restart backend setelah edit .env
docker compose restart api
```

**Email yang dikirim otomatis:**
- Verifikasi akun saat member baru didaftarkan
- Notifikasi peminjaman + token akses
- Reset password

---

## 7. MinIO File Storage

**Console web:** `http://localhost:9001`
- Username: nilai `MINIO_ACCESS_KEY` di `.env`
- Password: nilai `MINIO_SECRET_KEY` di `.env`

**Bucket `digilib` otomatis dibuat** saat startup dengan struktur:
```
digilib/
├── books/    ← file PDF ebook
├── covers/   ← cover image buku (publik)
└── avatar/   ← foto profil user (publik)
```

**Switch dari local → MinIO:**
```env
STORAGE_DRIVER=minio   # ubah dari "local" ke "minio"
```
```bash
docker compose restart api
```

> ⚠️ File yang sudah ada di volume `uploads_data` perlu dipindah manual ke MinIO
> jika switch dari local ke MinIO di tengah jalan.

---

## 8. Backup

### Jadwal
Backup berjalan otomatis setiap hari jam **02:00 WIB**.

### Lokasi backup
```
volume: backups_data  →  /backups/ di dalam container
```

### Cek backup manual
```bash
# Lihat log backup
docker exec digilib_backup cat /backups/backup.log

# Lihat file backup
docker exec digilib_backup ls -lh /backups/

# Jalankan backup manual sekarang
docker exec digilib_backup /backup/backup.sh
```

### Salin backup ke host
```bash
# Salin ke direktori lokal
docker cp digilib_backup:/backups/db_20240101_020000.sql.gz ./

# Atau mount volume langsung
docker run --rm -v digilib_backups_data:/backups -v $(pwd):/output \
  alpine tar czf /output/all_backups.tar.gz /backups
```

### Restore dari backup
```bash
# Decompress
gunzip db_20240101_020000.sql.gz

# Restore ke MySQL
docker exec -i digilib_db mysql \
  -u digilib_user -p"$MYSQL_PASSWORD" digilib_unismu \
  < db_20240101_020000.sql
```

### Retensi backup
Default 7 hari. Ubah di `.env`:
```env
BACKUP_RETENTION_DAYS=30   # simpan 30 hari
```

---

## 9. Monitoring

```bash
# Status semua container
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Resource usage
docker stats

# Log backend (real-time)
docker compose logs api -f --tail=100

# Log nginx
docker compose logs nginx -f

# Health check API
curl http://localhost:5000/api/health
```

---

## 10. Update Aplikasi

```bash
# Upload versi baru
# Edit file yang diperlukan

# Rebuild dan restart (tanpa downtime database)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build api frontend

# Jalankan migrasi jika ada perubahan schema
docker compose exec api npx prisma migrate deploy
```

---

## 11. Checklist Final Production

- [ ] Semua password default di `.env` sudah diganti
- [ ] JWT_SECRET dan JWT_REFRESH_SECRET menggunakan nilai random ≥64 karakter
- [ ] Domain mengarah ke server
- [ ] Sertifikat SSL berhasil diperoleh
- [ ] HTTPS config aktif di nginx
- [ ] VITE_API_URL sudah menggunakan `https://`
- [ ] SMTP dikonfigurasi dan test kirim berhasil
- [ ] MinIO berjalan dan bucket `digilib` terbentuk
- [ ] Backup service berjalan (cek `docker ps`)
- [ ] Backup manual pertama berhasil dijalankan
- [ ] Prisma migrate deploy berhasil
- [ ] Semua fitur ditest end-to-end di production URL
