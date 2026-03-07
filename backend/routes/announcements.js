const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateLength, parseId, sanitizeText } = require('../utils');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limit for announcement writes: 20 requests per 15 minutes per IP
const announcementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan, coba lagi setelah 15 menit' },
});

// GET /api/announcements  – public, returns 10 most recent announcements
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT a.id, a.title, a.content, a.created_at, u.name AS created_by_name
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/announcements  – admin and kepala IT only, create announcement
router.post('/', announcementLimiter, authenticate, requireAdmin, async (req, res) => {
  const { title, content } = req.body;
  if (!title?.trim() || !content?.trim()) {
    return res.status(400).json({ message: 'Judul dan konten wajib diisi' });
  }
  const titleErr = validateLength(title.trim(), 'Judul', 255);
  if (titleErr) return res.status(400).json({ message: titleErr });
  const contentErr = validateLength(content.trim(), 'Konten', 5000);
  if (contentErr) return res.status(400).json({ message: contentErr });

  try {
    const db = getDb();
    const sanitizedTitle = sanitizeText(title.trim());
    const sanitizedContent = sanitizeText(content.trim());
    const result = await db.query(
      `INSERT INTO announcements (title, content, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sanitizedTitle, sanitizedContent, req.user.id]
    );

    // Create notifications for all users (fire-and-forget)
    db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id)
       SELECT id, 'announcement', $1, $2, $3
       FROM users`,
      [
        `Pengumuman: ${sanitizedTitle}`,
        sanitizedContent.length > 150 ? sanitizedContent.slice(0, 147) + '...' : sanitizedContent,
        result.rows[0].id,
      ]
    ).catch((err) => console.error('Announcement notification error:', err));

    res.status(201).json({ message: 'Pengumuman berhasil dibuat', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// DELETE /api/announcements/:id  – admin and kepala IT only
router.delete('/:id', announcementLimiter, authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID pengumuman tidak valid' });

  try {
    const db = getDb();
    const result = await db.query(
      'DELETE FROM announcements WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Pengumuman tidak ditemukan' });
    res.json({ message: 'Pengumuman berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
