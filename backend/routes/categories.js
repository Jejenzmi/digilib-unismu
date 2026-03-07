const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { parseId, validateLength } = require('../utils');

const router = express.Router();

// GET /api/categories  – public
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT c.*, COUNT(b.id)::int AS book_count
       FROM categories c
       LEFT JOIN books b ON b.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// GET /api/categories/:id  – public
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID kategori tidak valid' });
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/categories  – admin only
router.post('/', authenticate, requireAdmin, async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Nama kategori wajib diisi' });

  const trimmedName = name.trim();
  const nameLenErr = validateLength(trimmedName, 'Nama kategori', 100);
  if (nameLenErr) return res.status(400).json({ message: nameLenErr });

  const descLenErr = description ? validateLength(description, 'Deskripsi', 500) : undefined;
  if (descLenErr) return res.status(400).json({ message: descLenErr });

  try {
    const db = getDb();
    const existing = await db.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1)', [trimmedName]);
    if (existing.rows[0]) return res.status(409).json({ message: 'Kategori sudah ada' });

    const result = await db.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [trimmedName, description || null]
    );
    res.status(201).json({ message: 'Kategori berhasil ditambahkan', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// PUT /api/categories/:id  – admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID kategori tidak valid' });
  const { name, description } = req.body;
  if (name !== undefined && (!name || !name.trim())) {
    return res.status(400).json({ message: 'Nama kategori tidak boleh kosong' });
  }
  if (name) {
    const nameLenErr = validateLength(name.trim(), 'Nama kategori', 100);
    if (nameLenErr) return res.status(400).json({ message: nameLenErr });
  }
  if (description) {
    const descLenErr = validateLength(description, 'Deskripsi', 500);
    if (descLenErr) return res.status(400).json({ message: descLenErr });
  }
  try {
    const db = getDb();
    const existing = await db.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const row = existing.rows[0];

    if (name && name.trim() !== row.name) {
      const duplicate = await db.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name.trim(), id]
      );
      if (duplicate.rows[0]) return res.status(409).json({ message: 'Nama kategori sudah digunakan' });
    }

    const result = await db.query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name !== undefined ? name.trim() : row.name, description ?? row.description, id]
    );
    res.json({ message: 'Kategori berhasil diperbarui', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// DELETE /api/categories/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID kategori tidak valid' });
  try {
    const db = getDb();
    const existing = await db.query('SELECT id FROM categories WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

    const booksCount = await db.query(
      'SELECT COUNT(*) AS count FROM books WHERE category_id = $1',
      [id]
    );
    const count = parseInt(booksCount.rows[0].count, 10);
    if (count > 0) {
      return res.status(400).json({
        message: `Kategori tidak dapat dihapus karena masih digunakan oleh ${count} buku. Pindahkan atau hapus buku tersebut terlebih dahulu.`,
      });
    }

    await db.query('DELETE FROM categories WHERE id = $1', [id]);
    res.json({ message: 'Kategori berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
