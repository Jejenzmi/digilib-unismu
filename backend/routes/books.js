const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { parsePagination, parseId, parseAvailableCopies, parseYear, validateLength } = require('../utils');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Rate limit for borrow/return: 30 requests per 15 minutes per IP
const borrowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Terlalu banyak permintaan peminjaman, coba lagi setelah 15 menit' },
});

// Helper to delete an uploaded file from disk (fire-and-forget)
function deleteUploadedFile(dir, filename) {
  if (!filename) return;
  fs.unlink(path.join(__dirname, '../uploads', dir, filename), (err) => {
    if (err) console.error(`Failed to delete ${dir}/${filename}:`, err);
  });
}

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
    const safeExt = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, `${unique}${safeExt}`);
  },
});

const allowedMimeTypes = {
  cover_image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  file: ['application/pdf'],
};

const allowedExtensions = {
  cover_image: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
  file: ['.pdf'],
};

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowedMime = allowedMimeTypes[file.fieldname];
    const allowedExt = allowedExtensions[file.fieldname];
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedMime && allowedMime.includes(file.mimetype) &&
      allowedExt && allowedExt.includes(ext)
    ) {
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

    if (search && search.length > 100) {
      return res.status(400).json({ message: 'Parameter pencarian terlalu panjang (maks. 100 karakter)' });
    }

    const db = getDb();
    let where = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (search) {
      where += ` AND (b.title ILIKE $${paramIdx} OR b.author ILIKE $${paramIdx} OR b.isbn ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx += 1;
    }
    const categoryIdNum = category_id ? parseInt(category_id, 10) : NaN;
    if (!isNaN(categoryIdNum) && categoryIdNum > 0) {
      where += ` AND b.category_id = $${paramIdx}`;
      params.push(categoryIdNum);
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
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID buku tidak valid' });
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT b.*, c.name AS category_name
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.id = $1`,
      [id]
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

    if (!title?.trim() || !author?.trim()) {
      return res.status(400).json({ message: 'Judul dan penulis wajib diisi' });
    }

    const titleLenErr = validateLength(title.trim(), 'Judul', 500);
    if (titleLenErr) return res.status(400).json({ message: titleLenErr });
    const authorLenErr = validateLength(author.trim(), 'Penulis', 255);
    if (authorLenErr) return res.status(400).json({ message: authorLenErr });
    const isbnLenErr = isbn ? validateLength(isbn, 'ISBN', 30) : undefined;
    if (isbnLenErr) return res.status(400).json({ message: isbnLenErr });
    const publisherLenErr = publisher ? validateLength(publisher, 'Penerbit', 255) : undefined;
    if (publisherLenErr) return res.status(400).json({ message: publisherLenErr });
    const descLenErr = description ? validateLength(description, 'Deskripsi', 5000) : undefined;
    if (descLenErr) return res.status(400).json({ message: descLenErr });

    const copiesResult = parseAvailableCopies(available_copies, 1);
    if (copiesResult.error) return res.status(400).json({ message: copiesResult.error });

    const yearResult = parseYear(year, null);
    if (yearResult.error) return res.status(400).json({ message: yearResult.error });

    const cover_image = req.files?.cover_image?.[0]?.filename || null;
    const file_path = req.files?.file?.[0]?.filename || null;

    try {
      const db = getDb();
      const result = await db.query(
        `INSERT INTO books (title, author, isbn, category_id, description, publisher, year, cover_image, file_path, available_copies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          title.trim(),
          author.trim(),
          isbn || null,
          category_id ? Number(category_id) : null,
          description || null,
          publisher || null,
          yearResult.year,
          cover_image,
          file_path,
          copiesResult.copies,
        ]
      );
      res.status(201).json({ message: 'Buku berhasil ditambahkan', data: result.rows[0] });
    } catch (dbErr) {
      console.error(dbErr);
      // Clean up uploaded files if DB insert failed
      deleteUploadedFile('covers', cover_image);
      deleteUploadedFile('files', file_path);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
});

// PUT /api/books/:id  – admin only
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID buku tidak valid' });

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const db = getDb();
      const existingResult = await db.query('SELECT * FROM books WHERE id = $1', [id]);
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

      const copiesResult = parseAvailableCopies(available_copies, existing.available_copies);
      if (copiesResult.error) return res.status(400).json({ message: copiesResult.error });

      const yearResult = parseYear(year, existing.year);
      if (yearResult.error) return res.status(400).json({ message: yearResult.error });

      if (title !== undefined) {
        if (!title.trim()) return res.status(400).json({ message: 'Judul tidak boleh kosong' });
        const titleLenErr = validateLength(title.trim(), 'Judul', 500);
        if (titleLenErr) return res.status(400).json({ message: titleLenErr });
      }
      if (author !== undefined) {
        if (!author.trim()) return res.status(400).json({ message: 'Penulis tidak boleh kosong' });
        const authorLenErr = validateLength(author.trim(), 'Penulis', 255);
        if (authorLenErr) return res.status(400).json({ message: authorLenErr });
      }
      const isbnLenErr = isbn ? validateLength(isbn, 'ISBN', 30) : undefined;
      if (isbnLenErr) return res.status(400).json({ message: isbnLenErr });
      const publisherLenErr = publisher ? validateLength(publisher, 'Penerbit', 255) : undefined;
      if (publisherLenErr) return res.status(400).json({ message: publisherLenErr });
      const descLenErr = description ? validateLength(description, 'Deskripsi', 5000) : undefined;
      if (descLenErr) return res.status(400).json({ message: descLenErr });

      let resolvedCategoryId = existing.category_id;
      if (category_id !== undefined) {
        if (category_id === '' || category_id === null) {
          resolvedCategoryId = null;
        } else {
          const catId = parseInt(category_id, 10);
          if (isNaN(catId) || catId <= 0) {
            return res.status(400).json({ message: 'ID kategori tidak valid' });
          }
          resolvedCategoryId = catId;
        }
      }

      const newCoverFilename = req.files?.cover_image?.[0]?.filename;
      const newFileFilename = req.files?.file?.[0]?.filename;

      const cover_image = newCoverFilename || existing.cover_image;
      const file_path = newFileFilename || existing.file_path;

      const updated = await db.query(
        `UPDATE books SET
          title = $1, author = $2, isbn = $3, category_id = $4, description = $5,
          publisher = $6, year = $7, cover_image = $8, file_path = $9,
          available_copies = $10, updated_at = NOW()
         WHERE id = $11
         RETURNING *`,
        [
          title != null ? title.trim() : existing.title,
          author != null ? author.trim() : existing.author,
          isbn ?? existing.isbn,
          resolvedCategoryId,
          description ?? existing.description,
          publisher ?? existing.publisher,
          yearResult.year,
          cover_image,
          file_path,
          copiesResult.copies,
          id,
        ]
      );

      // Delete replaced files from disk
      if (newCoverFilename && existing.cover_image) {
        deleteUploadedFile('covers', existing.cover_image);
      }
      if (newFileFilename && existing.file_path) {
        deleteUploadedFile('files', existing.file_path);
      }

      res.json({ message: 'Buku berhasil diperbarui', data: updated.rows[0] });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ message: 'Terjadi kesalahan pada server' });
    }
  });
});

// DELETE /api/books/:id  – admin only
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID buku tidak valid' });
  try {
    const db = getDb();
    const existing = await db.query('SELECT id, cover_image, file_path FROM books WHERE id = $1', [id]);
    if (!existing.rows[0]) return res.status(404).json({ message: 'Buku tidak ditemukan' });

    await db.query('DELETE FROM books WHERE id = $1', [id]);

    // Clean up uploaded files from disk
    const { cover_image, file_path } = existing.rows[0];
    deleteUploadedFile('covers', cover_image);
    deleteUploadedFile('files', file_path);

    res.json({ message: 'Buku berhasil dihapus' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

// POST /api/books/:id/borrow  – authenticated users
router.post('/:id/borrow', borrowLimiter, authenticate, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID buku tidak valid' });

  const db = getDb();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    // Lock the book row to prevent race conditions
    const bookResult = await client.query(
      'SELECT * FROM books WHERE id = $1 FOR UPDATE',
      [id]
    );
    const book = bookResult.rows[0];
    if (!book) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Buku tidak ditemukan' });
    }
    if (book.available_copies < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Stok buku tidak tersedia' });
    }

    const alreadyBorrowing = await client.query(
      "SELECT id FROM borrows WHERE user_id = $1 AND book_id = $2 AND status IN ('borrowed', 'overdue')",
      [req.user.id, id]
    );
    if (alreadyBorrowing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Anda sudah meminjam buku ini' });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14); // 2-week loan

    const result = await client.query(
      `INSERT INTO borrows (user_id, book_id, due_date)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, id, dueDate.toISOString()]
    );

    await client.query('UPDATE books SET available_copies = available_copies - 1 WHERE id = $1', [
      id,
    ]);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Peminjaman berhasil', data: result.rows[0] });
  } catch (err) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  } finally {
    client.release();
  }
});

// POST /api/books/:id/return  – authenticated users
router.post('/:id/return', borrowLimiter, authenticate, async (req, res) => {
  const id = parseId(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'ID buku tidak valid' });

  const db = getDb();
  const client = await db.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const borrowResult = await client.query(
      "SELECT * FROM borrows WHERE user_id = $1 AND book_id = $2 AND status IN ('borrowed', 'overdue')",
      [req.user.id, id]
    );
    const borrow = borrowResult.rows[0];

    if (!borrow) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Tidak ada peminjaman aktif untuk buku ini' });
    }

    await client.query(
      "UPDATE borrows SET status = 'returned', return_date = NOW() WHERE id = $1",
      [borrow.id]
    );

    await client.query('UPDATE books SET available_copies = available_copies + 1 WHERE id = $1', [
      id,
    ]);

    await client.query('COMMIT');
    res.json({ message: 'Pengembalian berhasil' });
  } catch (err) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  } finally {
    client.release();
  }
});
