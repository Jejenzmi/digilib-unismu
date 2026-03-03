const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { EMAIL_REGEX, parsePagination } = require('../utils');

const router = express.Router();

// GET /api/users/me  – get own profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// PUT /api/users/me  – update own profile
router.put('/me', authenticate, async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const db = getDb();
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    if (email && email !== user.email) {
      if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({ message: 'Format email tidak valid' });
      }
      const taken = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, req.user.id]
      );
      if (taken.rows[0]) return res.status(409).json({ message: 'Email sudah digunakan' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ message: 'Password minimal 6 karakter' });
    }

    const hashed = password ? bcrypt.hashSync(password, 10) : user.password;

    const updated = await db.query(
      'UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4 RETURNING id, name, email, role, created_at',
      [name ?? user.name, email ?? user.email, hashed, req.user.id]
    );
    res.json({ message: 'Profil berhasil diperbarui', data: updated.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// GET /api/users/me/borrows  – get own borrow history
router.get('/me/borrows', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT br.*, b.title, b.author, b.cover_image
       FROM borrows br
       JOIN books b ON br.book_id = b.id
       WHERE br.user_id = $1
       ORDER BY br.borrow_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// GET /api/users  – admin: list all users
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { page, limit, offset } = parsePagination(req.query, 20);

    const countResult = await db.query('SELECT COUNT(*) as count FROM users');
    const total = parseInt(countResult.rows[0].count, 10);

    const usersResult = await db.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ total, page, limit, data: usersResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// DELETE /api/users/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const userResult = await db.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!userResult.rows[0]) return res.status(404).json({ message: 'User tidak ditemukan' });

    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// GET /api/users/borrows  – admin: all borrow records
router.get('/borrows', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;
    const { page, limit, offset } = parsePagination(req.query, 20);

    let where = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (status) {
      where += ` AND br.status = $${paramIdx}`;
      params.push(status);
      paramIdx += 1;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM borrows br ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const borrowsResult = await db.query(
      `SELECT br.*, u.name AS user_name, u.email AS user_email,
              b.title AS book_title, b.author AS book_author
       FROM borrows br
       JOIN users u ON br.user_id = u.id
       JOIN books b ON br.book_id = b.id
       ${where}
       ORDER BY br.borrow_date DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({ total, page, limit, data: borrowsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
