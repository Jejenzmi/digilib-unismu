const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');
const { EMAIL_REGEX } = require('../utils');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
  }

  const emailRegex = EMAIL_REGEX;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ message: 'Format email tidak valid' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter' });
  }

  try {
    const db = getDb();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);
    if (existing.rows[0]) {
      return res.status(409).json({ message: 'Email sudah terdaftar' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const result = await db.query(
      "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user') RETURNING id",
      [trimmedName, trimmedEmail, hashed]
    );

    const userId = result.rows[0].id;
    const token = jwt.sign(
      { id: userId, email: trimmedEmail, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Registrasi berhasil',
      token,
      user: { id: userId, name: trimmedName, email: trimmedEmail, role: 'user' },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi' });
  }

  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Email atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Login berhasil',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
