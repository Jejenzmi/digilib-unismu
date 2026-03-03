const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories  – public
router.get('/', (req, res) => {
  const db = getDb();
  const categories = db
    .prepare(
      `SELECT c.*, COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON b.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    )
    .all();
  res.json(categories);
});

// GET /api/categories/:id  – public
router.get('/:id', (req, res) => {
  const db = getDb();
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!category) return res.status(404).json({ message: 'Kategori tidak ditemukan' });
  res.json(category);
});

// POST /api/categories  – admin only
router.post('/', authenticate, requireAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Nama kategori wajib diisi' });

  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ message: 'Kategori sudah ada' });

  const result = db
    .prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
    .run(name, description || null);

  const category = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json({ message: 'Kategori berhasil ditambahkan', data: category });
});

// PUT /api/categories/:id  – admin only
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const { name, description } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

  db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(
    name ?? existing.name,
    description ?? existing.description,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ message: 'Kategori berhasil diperbarui', data: updated });
});

// DELETE /api/categories/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Kategori tidak ditemukan' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ message: 'Kategori berhasil dihapus' });
});

module.exports = router;
