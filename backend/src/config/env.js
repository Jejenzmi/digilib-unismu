// src/config/env.js
// Satu-satunya tempat membaca process.env.
// Semua modul lain import dari sini — tidak boleh process.env langsung.

function validateEnv() {
  // Lewati validasi ketat saat test (env sudah di-set di globalSetup)
  if (process.env.NODE_ENV === "test") return;

  const required = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"];
  const missing  = required.filter(k => !process.env[k]?.trim());

  if (missing.length) {
    console.error("\n❌ FATAL: Environment variable wajib tidak ditemukan:");
    missing.forEach(k => console.error(`   • ${k}`));
    console.error("\n💡 Salin .env.example ke .env dan isi nilainya.\n");
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.error("❌ FATAL: JWT_SECRET harus minimal 32 karakter.");
    process.exit(1);
  }
  if (process.env.JWT_REFRESH_SECRET.length < 32) {
    console.error("❌ FATAL: JWT_REFRESH_SECRET harus minimal 32 karakter.");
    process.exit(1);
  }

  const defaultPlaceholders = [
    "GANTI_DENGAN_STRING_ACAK_MINIMAL_32_KARAKTER_AAAAAAAAAAAAAAAA",
    "GANTI_DENGAN_STRING_ACAK_LAIN_MINIMAL_32_KARAKTER_BBBBBBBBBB",
  ];
  if (process.env.NODE_ENV === "production") {
    defaultPlaceholders.forEach(p => {
      if (process.env.JWT_SECRET === p || process.env.JWT_REFRESH_SECRET === p) {
        console.error("❌ FATAL: JWT secret masih menggunakan nilai placeholder di production!");
        process.exit(1);
      }
    });
  }
}

const env = {
  port:                parseInt(process.env.PORT || "5000"),
  nodeEnv:             process.env.NODE_ENV || "development",
  isTest:              process.env.NODE_ENV === "test",
  isProd:              process.env.NODE_ENV === "production",
  isDev:               !["production", "test"].includes(process.env.NODE_ENV),

  jwtSecret:           process.env.JWT_SECRET           || "test_fallback_secret_xxxxxxxxxxxxxxxx",
  jwtExpiresIn:        process.env.JWT_EXPIRES_IN        || "1h",
  jwtRefreshSecret:    process.env.JWT_REFRESH_SECRET    || "test_fallback_refresh_yyyyyyyyyyyyyyyyy",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  frontendUrl:         process.env.FRONTEND_URL          || "http://localhost:3000",
  uploadPath:          process.env.UPLOAD_PATH            || "./uploads",
  maxFileSizeMb:       parseInt(process.env.MAX_FILE_SIZE_MB || "20"),

  rateLimitWindowMs:   parseInt(process.env.RATE_LIMIT_WINDOW_MS  || "900000"),
  rateLimitMax:        parseInt(process.env.RATE_LIMIT_MAX        || "100"),
  loginRateLimitMax:   parseInt(process.env.LOGIN_RATE_LIMIT_MAX  || "5"),

  logDir:              process.env.LOG_DIR    || "./logs",
  logLevel:            process.env.LOG_LEVEL  || "info",

  // SMTP (opsional — email verifikasi & notifikasi)
  smtpHost:            process.env.SMTP_HOST     || "",
  smtpPort:            parseInt(process.env.SMTP_PORT || "587"),
  smtpSecure:          process.env.SMTP_SECURE === "true",
  smtpUser:            process.env.SMTP_USER     || "",
  smtpPass:            process.env.SMTP_PASS     || "",
  smtpFrom:            process.env.SMTP_FROM     || "",

  // MinIO / S3 storage (opsional)
  storageDriver:       process.env.STORAGE_DRIVER     || "local",  // "local" | "minio"
  minioEndpoint:       process.env.MINIO_ENDPOINT     || "minio",
  minioPort:           parseInt(process.env.MINIO_PORT     || "9000"),
  minioUseSSL:         process.env.MINIO_USE_SSL === "true",
  minioAccessKey:      process.env.MINIO_ACCESS_KEY   || "minioadmin",
  minioSecretKey:      process.env.MINIO_SECRET_KEY   || "minioadmin",
  minioBucket:         process.env.MINIO_BUCKET        || "digilib",
  minioPublicUrl:      process.env.MINIO_PUBLIC_URL   || "http://localhost:9000",
};

module.exports = { validateEnv, env };
