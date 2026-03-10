#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# backup.sh — Backup otomatis MySQL + file uploads
# Dijalankan oleh container backup via cron setiap hari jam 02:00
# ─────────────────────────────────────────────────────────────────────────────
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_BACKUP="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
FILES_BACKUP="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
LOG_FILE="$BACKUP_DIR/backup.log"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

echo "[$TIMESTAMP] ▶ Memulai backup..." | tee -a "$LOG_FILE"

# ── 1. Backup MySQL ─────────────────────────────────────────────────────────
echo "[$(date +%H:%M:%S)] 📦 Backup database..." | tee -a "$LOG_FILE"
mysqldump \
  --host="${MYSQL_HOST:-db}" \
  --user="${MYSQL_USER:-digilib_user}" \
  --password="${MYSQL_PASSWORD}" \
  --single-transaction \
  --routines \
  --triggers \
  --set-gtid-purged=OFF \
  "${MYSQL_DATABASE:-digilib_unismu}" \
  | gzip > "$DB_BACKUP"

DB_SIZE=$(du -sh "$DB_BACKUP" | cut -f1)
echo "[$(date +%H:%M:%S)] ✅ Database backup: $DB_BACKUP ($DB_SIZE)" | tee -a "$LOG_FILE"

# ── 2. Backup file uploads ───────────────────────────────────────────────────
if [ -d "/uploads" ] && [ "$(ls -A /uploads 2>/dev/null)" ]; then
  echo "[$(date +%H:%M:%S)] 📁 Backup file uploads..." | tee -a "$LOG_FILE"
  tar -czf "$FILES_BACKUP" -C / uploads 2>/dev/null || true
  FILES_SIZE=$(du -sh "$FILES_BACKUP" | cut -f1)
  echo "[$(date +%H:%M:%S)] ✅ Files backup: $FILES_BACKUP ($FILES_SIZE)" | tee -a "$LOG_FILE"
else
  echo "[$(date +%H:%M:%S)] ℹ️  Tidak ada file uploads untuk di-backup" | tee -a "$LOG_FILE"
fi

# ── 3. Hapus backup lama (lebih dari RETENTION_DAYS hari) ───────────────────
echo "[$(date +%H:%M:%S)] 🧹 Membersihkan backup lama (>${RETENTION_DAYS} hari)..." | tee -a "$LOG_FILE"
find "$BACKUP_DIR" -name "*.sql.gz"   -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.tar.gz"   -mtime "+${RETENTION_DAYS}" -delete 2>/dev/null || true

# ── 4. Ringkasan ─────────────────────────────────────────────────────────────
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "*.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "[$(date +%H:%M:%S)] ✅ Backup selesai. Total: $TOTAL_BACKUPS file, ukuran: $TOTAL_SIZE" | tee -a "$LOG_FILE"
echo "──────────────────────────────────────────────" >> "$LOG_FILE"
