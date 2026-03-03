const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { parsePagination } = require('../utils');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Multer config for cover images and PDF files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest =
      file.fieldname === 'cover_image'
        ? path.join(__dirname, '../uploads/covers')
        : path.join(__dirname, '../uploads/files');
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const allowedMimeTypes = {
  cover_image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  file: ['application/pdf'],
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = allowedMimeTypes[file.fieldname];
    if (allowed && allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file tidak diizinkan untuk field ${file.fieldname}`));
    }
  },
}).fields([
  { name: 'cover_image', maxCount: 1 },
  { name: 'file', maxCount: 1 },
]);

// GET /api/books  – public, supports search and category filter
router.get('/', (req, res) => {
  const { search, category_id } = req.query;
  const { page, limit, offset } = parsePagination(req.query);

  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];

  if (search) {
    where += ' AND (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (category_id) {
    where += ' AND b.category_id = ?';
    params.push(Number(category_id));
  }

  const total = db
    .prepare(
      `SELECT COUNT(*) as count FROM books b ${where}`
    )
    .get(...params).count;

  const books = db
    .prepare(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({ total, page, limit, data: books });
});

// GET /api/books/:id  – public
router.get('/:id', (req, res) => {
  const db = getDb();
  const book = db
    .prepare(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = ?`
    )
    .get(req.params.id);

  if (!book) return res.status(404).json({ message: 'Buku tidak ditemukan' });
  res.json(book);
});

// POST /api/books  – admin only
router.post('/', authenticate, requireAdmin, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });

    const { title, author, isbn, category_id, description, publisher, year, available_copies } =
      req.body;

    if (!title || !author) {
      return res.status(400).json({ message: 'Judul dan penulis wajib diisi' });
    }

    const cover_image = req.files?.cover_image?.[0]?.filename || null;
    const file_path = req.files?.file?.[0]?.filename || null;

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO books (title, author, isbn, category_id, description, publisher, year, cover_image, file_path, available_copies)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        author,
        isbn || null,
        category_id ? Number(category_id) : null,
        description || null,
        publisher || null,
        year ? Number(year) : null,
        cover_image,
        file_path,
        available_copies ? Number(available_copies) : 1
      );

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Buku berhasil ditambahkan', data: book });
  });
});

// PUT /api/books/:id  – admin only
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });

    const db = getDb();
    const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Buku tidak ditemukan' });

    const {
      title,
      author,
      isbn,
      category_id,
      description,
      publisher,
      year,
      available_copies,
    } = req.body;

    const cover_image = req.files?.cover_image?.[0]?.filename || existing.cover_image;
    const file_path = req.files?.file?.[0]?.filename || existing.file_path;

    db.prepare(
      `UPDATE books SET
        title = ?, author = ?, isbn = ?, category_id = ?, description = ?,
        publisher = ?, year = ?, cover_image = ?, file_path = ?,
        available_copies = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      title ?? existing.title,
      author ?? existing.author,
      isbn ?? existing.isbn,
      category_id ? Number(category_id) : existing.category_id,
      description ?? existing.description,
      publisher ?? existing.publisher,
      year ? Number(year) : existing.year,
      cover_image,
      file_path,
      available_copies ? Number(available_copies) : existing.available_copies,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
    res.json({ message: 'Buku berhasil diperbarui', data: updated });
  });
});

// DELETE /api/books/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Buku tidak ditemukan' });

  db.prepare('DELETE FROM books WHERE id = ?').run(req.params.id);
  res.json({ message: 'Buku berhasil dihapus' });
});

// POST /api/books/:id/borrow  – authenticated users
router.post('/:id/borrow', authenticate, (req, res) => {
  const db = getDb();
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(req.params.id);
  if (!book) return res.status(404).json({ message: 'Buku tidak ditemukan' });
  if (book.available_copies < 1) {
    return res.status(400).json({ message: 'Stok buku tidak tersedia' });
  }

  const alreadyBorrowing = db
    .prepare(
      "SELECT id FROM borrows WHERE user_id = ? AND book_id = ? AND status = 'borrowed'"
    )
    .get(req.user.id, req.params.id);
  if (alreadyBorrowing) {
    return res.status(400).json({ message: 'Anda sudah meminjam buku ini' });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14); // 2-week loan

  const result = db
    .prepare(
      `INSERT INTO borrows (user_id, book_id, due_date)
       VALUES (?, ?, ?)`
    )
    .run(req.user.id, req.params.id, dueDate.toISOString());

  db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(
    req.params.id
  );

  res.status(201).json({
    message: 'Peminjaman berhasil',
    data: db.prepare('SELECT * FROM borrows WHERE id = ?').get(result.lastInsertRowid),
  });
});

// POST /api/books/:id/return  – authenticated users
router.post('/:id/return', authenticate, (req, res) => {
  const db = getDb();
  const borrow = db
    .prepare(
      "SELECT * FROM borrows WHERE user_id = ? AND book_id = ? AND status = 'borrowed'"
    )
    .get(req.user.id, req.params.id);

  if (!borrow) {
    return res.status(400).json({ message: 'Tidak ada peminjaman aktif untuk buku ini' });
  }

  db.prepare(
    "UPDATE borrows SET status = 'returned', return_date = datetime('now') WHERE id = ?"
  ).run(borrow.id);

  db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(
    req.params.id
  );

  res.json({ message: 'Pengembalian berhasil' });
});

module.exports = router;
