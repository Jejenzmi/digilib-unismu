// src/index.js
// ─── Load environment SEBELUM import modul lain ───────────────────────────────
const path = require("path");
const envFile = process.env.NODE_ENV === "test" ? ".env.test" : ".env";
require("dotenv").config({ path: path.resolve(process.cwd(), envFile) });

const { validateEnv, env } = require("./config/env");
validateEnv();

// ─── Import library ───────────────────────────────────────────────────────────
const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const compression  = require("compression");
const rateLimit    = require("express-rate-limit");
const morgan       = require("morgan");
const swaggerUi    = require("swagger-ui-express");

// ─── Internal modules ─────────────────────────────────────────────────────────
const logger       = require("./config/logger");
const swaggerSpec  = require("./config/swagger");
const requestId    = require("./middleware/requestId.middleware");
const { notFound, errorHandler } = require("./middleware/error.middleware");
const { prisma }   = require("./utils/prisma");

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes       = require("./routes/auth.routes");
const userRoutes       = require("./routes/user.routes");
const bookRoutes       = require("./routes/book.routes");
const peminjamanRoutes = require("./routes/peminjaman.routes");
const skripsiRoutes    = require("./routes/skripsi.routes");
const jurnalRoutes     = require("./routes/jurnal.routes");
const fakultasRoutes   = require("./routes/fakultas.routes");
const settingRoutes    = require("./routes/setting.routes");
const laporanRoutes    = require("./routes/laporan.routes");
const logRoutes        = require("./routes/log.routes");
const bookmarkRoutes   = require("./routes/bookmark.routes");

// ─── createApp() diekspos agar bisa di-import di test tanpa .listen() ─────────
function createApp() {
  const app = express();

  // ── Trust proxy — WAJIB jika deploy di belakang Nginx / Traefik / Caddy ──
  // Tanpa ini, req.ip selalu mengembalikan IP Docker network (172.x.x.x),
  // sehingga rate limiting login tidak bekerja (semua user dianggap 1 IP).
  // Nilai 1 = percaya 1 level proxy (misal: Nginx → Node.js)
  if (env.isProd) {
    app.set("trust proxy", 1);
  }

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // izinkan akses file statis
    // Swagger UI butuh inline scripts, styles, dan CDN assets (unpkg.com).
    // Kita override CSP hanya untuk path /api/docs — path lain tetap ketat.
    contentSecurityPolicy: {
      directives: {
        defaultSrc:  ["'self'"],
        scriptSrc:   ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
        styleSrc:    ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
        imgSrc:      ["'self'", "data:", "https:"],
        fontSrc:     ["'self'", "https://fonts.gstatic.com"],
        connectSrc:  ["'self'"],
        workerSrc:   ["'self'", "blob:"],
      },
    },
  }));

  app.use(cors({
    origin: (origin, cb) => {
      // Tidak ada origin = curl / Postman / server-to-server → izinkan
      if (!origin) return cb(null, true);
      // Test environment → izinkan semua
      if (env.isTest) return cb(null, true);

      const allowed = [
        ...env.frontendUrl.split(",").map(s => s.trim()),
        // Selalu izinkan localhost (Swagger UI, developer tools)
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5000",
      ];

      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error(`Origin '${origin}' tidak diizinkan oleh CORS`));
    },
    credentials: true,
    exposedHeaders: ["X-Request-Id", "Content-Disposition"],
  }));

  // ── Compression & parsing ─────────────────────────────────────────────────
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ── Request ID — HARUS sebelum semua middleware lain ──────────────────────
  app.use(requestId);

  // ── HTTP logging ─────────────────────────────────────────────────────────
  if (!env.isTest && env.logLevel !== "silent") {
    app.use(morgan("combined", { stream: logger.stream }));
  }

  // ── Global rate limit ─────────────────────────────────────────────────────
  if (!env.isTest) {
    app.use(rateLimit({
      windowMs: env.rateLimitWindowMs,
      max:      env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders:   false,
      message: { success: false, message: "Terlalu banyak request. Coba lagi beberapa saat." },
    }));
  }

  // ── Static files ──────────────────────────────────────────────────────────
  app.use("/uploads", express.static(path.join(process.cwd(), env.uploadPath)));

  // ── Swagger UI ───────────────────────────────────────────────────────────
  /**
   * @swagger
   * /api/health:
   *   get:
   *     tags: [System]
   *     summary: Health check — status server dan koneksi database
   *     security: []
   *     responses:
   *       200:
   *         description: Server berjalan normal
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:    { type: string, example: "ok" }
   *                 timestamp: { type: string, format: date-time }
   *                 uptime:    { type: number, description: "Uptime server dalam detik" }
   *                 database:  { type: string, enum: [connected, disconnected] }
   *                 version:   { type: string, example: "3.0.0" }
   *       503:
   *         description: Database tidak dapat dihubungi
   */
  app.get("/api/health", async (req, res) => {
    let dbStatus = "connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "disconnected";
    }
    const status = dbStatus === "connected" ? 200 : 503;
    res.status(status).json({
      success:   status === 200,
      requestId: res.locals.requestId,
      status:    status === 200 ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      database:  dbStatus,
      version:   "3.0.0",
      env:       env.nodeEnv,
    });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle:    "Digilib UNISMU API v3",
    customCss:          ".swagger-ui .topbar { background-color: #6366f1; }",
    customfavIcon:      "/favicon.ico",
    swaggerOptions:     { persistAuthorization: true },
  }));

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use("/api/auth",       authRoutes);
  app.use("/api/users",      userRoutes);
  app.use("/api/books",      bookRoutes);
  app.use("/api/peminjaman", peminjamanRoutes);
  app.use("/api/skripsi",    skripsiRoutes);
  app.use("/api/jurnal",     jurnalRoutes);
  app.use("/api/fakultas",   fakultasRoutes);
  app.use("/api/settings",   settingRoutes);
  app.use("/api/laporan",    laporanRoutes);
  app.use("/api/log",        logRoutes);
  app.use("/api/bookmark",   bookmarkRoutes);

  // Root redirect ke docs
  app.get("/", (req, res) => res.redirect("/api/docs"));

  // ── Error handlers — HARUS paling bawah ──────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

// ─── Boot server (hanya jika dijalankan langsung, bukan di-require test) ──────
if (require.main === module) {
  const { startCronJobs, runStartupJobs } = require("./jobs/cron.jobs");
  const app = createApp();

  const server = app.listen(env.port, async () => {
    logger.info(`\n🚀 Digilib UNISMU v3 — ${env.nodeEnv.toUpperCase()}`);
    logger.info(`📡 Server     : http://localhost:${env.port}`);
    logger.info(`📚 Swagger UI : http://localhost:${env.port}/api/docs`);
    logger.info(`❤️  Health     : http://localhost:${env.port}/api/health`);

    // Startup jobs (catch-up status terlambat dll)
    await runStartupJobs().catch(e => logger.error(`Startup jobs error: ${e.message}`));

    // Aktifkan cron
    startCronJobs();
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal) => {
    logger.info(`\n⚠️  ${signal} diterima — menutup server...`);
    server.close(async () => {
      logger.info("🔌 HTTP server ditutup");
      await prisma.$disconnect();
      logger.info("🗄️  Koneksi database ditutup");
      logger.info("✅ Server berhenti dengan bersih");
      process.exit(0);
    });

    // Force exit jika terlalu lama
    setTimeout(() => {
      logger.error("⏰ Force exit — graceful shutdown timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    logger.error("💥 Uncaught Exception:", { message: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("💥 Unhandled Rejection:", { reason: String(reason) });
    process.exit(1);
  });
}

module.exports = { createApp };
