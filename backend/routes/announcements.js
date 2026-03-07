const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateLength, parseId } = require('../utils');

const router = express.Router();

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

// POST /api/announcements  – admin only, create announcement
router.post('/', authenticate, requireAdmin, async (req, res) => {
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
    const result = await db.query(
      `INSERT INTO announcements (title, content, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title.trim(), content.trim(), req.user.id]
    );
    res.status(201).json({ message: 'Pengumuman berhasil dibuat', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// DELETE /api/announcements/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
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
