FROM alpine:3.19

# Install mysql-client dan utilitas
RUN apk add --no-cache \
    mysql-client \
    gzip \
    tar \
    tzdata \
    busybox-suid

# Timezone Asia/Jakarta
RUN cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && \
    echo "Asia/Jakarta" > /etc/timezone

# Cron schedule: backup jam 02:00 setiap hari
RUN echo "0 2 * * * /backup/backup.sh >> /backups/cron.log 2>&1" | crontab -

# Salin script
COPY backup.sh /backup/backup.sh
RUN chmod +x /backup/backup.sh

# Buat direktori backup
RUN mkdir -p /backups

CMD ["crond", "-f", "-l", "2"]
