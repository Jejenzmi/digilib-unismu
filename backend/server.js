require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initSchema } = require('./database/db');
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const categoriesRoutes = require('./routes/categories');
const usersRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');
const announcementsRoutes = require('./routes/announcements');

if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET tidak diatur di file .env');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL tidak diatur di file .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// General API rate limit: 200 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan, coba lagi setelah 15 menit' },
});

// Strict rate limit for auth endpoints: 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak percobaan login, coba lagi setelah 15 menit' },
});

app.use('/api', generalLimiter);

// Serve uploaded files (cover images, PDFs)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/announcements', announcementsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Digilib UNISMU API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan' });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
      console.log(`📚 Digilib UNISMU API siap digunakan`);
    });
  })
  .catch((err) => {
    console.error('Gagal inisialisasi skema database:', err);
    process.exit(1);
  });

module.exports = app;
