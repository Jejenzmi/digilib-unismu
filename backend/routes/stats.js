const express = require('express');
const { getDb } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats  – admin: overall library statistics
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = getDb();

    const [
      totalsResult,
      borrowStatusResult,
      topBooksResult,
      borrowsByMonthResult,
      finesResult,
    ] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM books)      AS total_books,
          (SELECT COUNT(*) FROM categories) AS total_categories,
          (SELECT COUNT(*) FROM users)      AS total_users,
          (SELECT COUNT(*) FROM borrows)    AS total_borrows
      `),
      db.query(`
        SELECT status, COUNT(*) AS count
        FROM borrows
        GROUP BY status
      `),
      db.query(`
        SELECT b.id, b.title, b.author, COUNT(br.id) AS borrow_count
        FROM books b
        JOIN borrows br ON b.id = br.book_id
        GROUP BY b.id, b.title, b.author
        ORDER BY borrow_count DESC
        LIMIT 5
      `),
      db.query(`
        SELECT TO_CHAR(borrow_date, 'YYYY-MM') AS month, COUNT(*) AS count
        FROM borrows
        WHERE borrow_date >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month ASC
      `),
      db.query(`
        SELECT COALESCE(SUM(
          CASE
            WHEN status = 'overdue'
              THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (NOW() - due_date)) / 86400))::INTEGER * 1000
            WHEN status = 'returned' AND return_date > due_date
              THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (return_date - due_date)) / 86400))::INTEGER * 1000
            ELSE 0
          END
        ), 0) AS total_fines
        FROM borrows
      `),
    ]);

    const totals = totalsResult.rows[0];

    const statusMap = { borrowed: 0, returned: 0, overdue: 0 };
    for (const row of borrowStatusResult.rows) {
      statusMap[row.status] = parseInt(row.count, 10);
    }

    res.json({
      total_books: parseInt(totals.total_books, 10),
      total_categories: parseInt(totals.total_categories, 10),
      total_users: parseInt(totals.total_users, 10),
      total_borrows: parseInt(totals.total_borrows, 10),
      active_borrows: statusMap.borrowed,
      overdue_borrows: statusMap.overdue,
      returned_borrows: statusMap.returned,
      total_fines: parseInt(finesResult.rows[0].total_fines, 10),
      top_books: topBooksResult.rows.map((r) => ({
        id: r.id,
        title: r.title,
        author: r.author,
        borrow_count: parseInt(r.borrow_count, 10),
      })),
      borrows_by_month: borrowsByMonthResult.rows.map((r) => ({
        month: r.month,
        count: parseInt(r.count, 10),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
});

module.exports = router;
