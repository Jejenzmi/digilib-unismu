const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { EMAIL_REGEX, parsePagination } = require('../utils');

const router = express.Router();

// GET /api/users/me  – get own profile
router.get('/me', authenticate, (req, res) => {
  const db = getDb();
  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
  res.json(user);
});

// PUT /api/users/me  – update own profile
router.put('/me', authenticate, (req, res) => {
  const { name, email, password } = req.body;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

  if (email && email !== user.email) {
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid' });
    }
    const taken = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(email, req.user.id);
    if (taken) return res.status(409).json({ message: 'Email sudah digunakan' });
  }

  if (password && password.length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter' });
  }

  const hashed = password ? bcrypt.hashSync(password, 10) : user.password;

  db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(
    name ?? user.name,
    email ?? user.email,
    hashed,
    req.user.id
  );

  const updated = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({ message: 'Profil berhasil diperbarui', data: updated });
});

// GET /api/users/me/borrows  – get own borrow history
router.get('/me/borrows', authenticate, (req, res) => {
  const db = getDb();
  const borrows = db
    .prepare(
      `SELECT br.*, b.title, b.author, b.cover_image
       FROM borrows br
       JOIN books b ON br.book_id = b.id
       WHERE br.user_id = ?
       ORDER BY br.borrow_date DESC`
    )
    .all(req.user.id);
  res.json(borrows);
});

// GET /api/users  – admin: list all users
router.get('/', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { page, limit, offset } = parsePagination(req.query, 20);

  const total = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const users = db
    .prepare(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?'
    )
    .all(limit, offset);

  res.json({ total, page, limit, data: users });
});

// DELETE /api/users/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User berhasil dihapus' });
});

// GET /api/users/borrows  – admin: all borrow records
router.get('/borrows', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const { status } = req.query;
  const { page, limit, offset } = parsePagination(req.query, 20);

  let where = 'WHERE 1=1';
  const params = [];
  if (status) {
    where += ' AND br.status = ?';
    params.push(status);
  }

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM borrows br ${where}`)
    .get(...params).count;

  const borrows = db
    .prepare(
      `SELECT br.*, u.name AS user_name, u.email AS user_email,
              b.title AS book_title, b.author AS book_author
       FROM borrows br
       JOIN users u ON br.user_id = u.id
       JOIN books b ON br.book_id = b.id
       ${where}
       ORDER BY br.borrow_date DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({ total, page, limit, data: borrows });
});

module.exports = router;
