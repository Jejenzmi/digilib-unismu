const express = require('express');
const { getDb } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { parseId } = require('../utils');

const router = express.Router();

// GET /api/notifications  – get current user's notifications (latest 50)
router.get('/', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT id, type, title, message, is_read, related_id, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    const unread = result.rows.filter((n) => !n.is_read).length;
    res.json({ notifications: result.rows, unread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// PUT /api/notifications/:id/read  – mark single notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID notifikasi tidak valid' });
  try {
    const db = getDb();
    const result = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    res.json({ message: 'Notifikasi ditandai sudah dibaca' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// PUT /api/notifications/read-all  – mark all notifications as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const db = getDb();
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ message: 'Semua notifikasi ditandai sudah dibaca' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// DELETE /api/notifications/:id  – delete a single notification
router.delete('/:id', authenticate, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID notifikasi tidak valid' });
  try {
    const db = getDb();
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Notifikasi tidak ditemukan' });
    res.json({ message: 'Notifikasi berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
