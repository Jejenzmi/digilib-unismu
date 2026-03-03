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
router.get('/', async (req, res) => {
  try {
    const { search, category_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const db = getDb();
    let where = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (b.title ILIKE $${paramIdx} OR b.author ILIKE $${paramIdx} OR b.isbn ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx += 1;
    }
    if (category_id) {
      where += ` AND b.category_id = $${paramIdx}`;
      params.push(Number(category_id));
      paramIdx += 1;
    }

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM books b ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const booksResult = await db.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       ${where}
       ORDER BY b.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({ total, page, limit, data: booksResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// GET /api/books/:id  – public
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/books  – admin only
router.post('/', authenticate, requireAdmin, async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    const { title, author, isbn, category_id, description, publisher, year, available_copies } =
      req.body;

    if (!title || !author) {
      return res.status(400).json({ message: 'Judul dan penulis wajib diisi' });
    }

    const cover_image = req.files?.cover_image?.[0]?.filename || null;
    const file_path = req.files?.file?.[0]?.filename || null;

    try {
      const db = getDb();
      const result = await db.query(
        `INSERT INTO books (title, author, isbn, category_id, description, publisher, year, cover_image, file_path, available_copies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          title,
          author,
          isbn || null,
          category_id ? Number(category_id) : null,
          description || null,
          publisher || null,
          year ? Number(year) : null,
          cover_image,
          file_path,
          available_copies ? Number(available_copies) : 1,
        ]
      );
      res.status(201).json({ message: 'Buku berhasil ditambahkan', data: result.rows[0] });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
});

// PUT /api/books/:id  – admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const db = getDb();
      const existingResult = await db.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
      if (!existingResult.rows[0]) return res.status(404).json({ message: 'Buku tidak ditemukan' });

      const existing = existingResult.rows[0];
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

      const updated = await db.query(
        `UPDATE books SET
          title = $1, author = $2, isbn = $3, category_id = $4, description = $5,
          publisher = $6, year = $7, cover_image = $8, file_path = $9,
          available_copies = $10, updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
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
          req.params.id,
        ]
      );
      res.json({ message: 'Buku berhasil diperbarui', data: updated.rows[0] });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
});

// DELETE /api/books/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const existing = await db.query('SELECT id FROM books WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Buku tidak ditemukan' });

    await db.query('DELETE FROM books WHERE id = $1', [req.params.id]);
    res.json({ message: 'Buku berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/books/:id/borrow  – authenticated users
router.post('/:id/borrow', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const bookResult = await db.query('SELECT * FROM books WHERE id = $1', [req.params.id]);
    const book = bookResult.rows[0];
    if (!book) return res.status(404).json({ message: 'Buku tidak ditemukan' });
    if (book.available_copies < 1) {
      return res.status(400).json({ message: 'Stok buku tidak tersedia' });
    }

    const alreadyBorrowing = await db.query(
      "SELECT id FROM borrows WHERE user_id = $1 AND book_id = $2 AND status = 'borrowed'",
      [req.user.id, req.params.id]
    );
    if (alreadyBorrowing.rows[0]) {
      return res.status(400).json({ message: 'Anda sudah meminjam buku ini' });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2-week loan

    const result = await db.query(
      `INSERT INTO borrows (user_id, book_id, due_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, req.params.id, dueDate.toISOString()]
    );

    await db.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [
      req.params.id,
    ]);

    res.status(201).json({ message: 'Peminjaman berhasil', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/books/:id/return  – authenticated users
router.post('/:id/return', authenticate, async (req, res) => {
  try {
    const db = getDb();
    const borrowResult = await db.query(
      "SELECT * FROM borrows WHERE user_id = $1 AND book_id = $2 AND status = 'borrowed'",
      [req.user.id, req.params.id]
    );
    const borrow = borrowResult.rows[0];

    if (!borrow) {
      return res.status(400).json({ message: 'Tidak ada peminjaman aktif untuk buku ini' });
    }

    await db.query(
      "UPDATE borrows SET status = 'returned', return_date = NOW() WHERE id = $1",
      [borrow.id]
    );

    await db.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = $1', [
      req.params.id,
    ]);

    res.json({ message: 'Pengembalian berhasil' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
