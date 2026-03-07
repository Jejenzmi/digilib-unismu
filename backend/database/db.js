require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT        NOT NULL,
      email      TEXT        NOT NULL UNIQUE,
      password   TEXT        NOT NULL,
      role       TEXT        NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user','kepala IT')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          SERIAL PRIMARY KEY,
      name        TEXT        NOT NULL UNIQUE,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS books (
      id               SERIAL PRIMARY KEY,
      title            TEXT        NOT NULL,
      author           TEXT        NOT NULL,
      isbn             TEXT        UNIQUE,
      category_id      INTEGER     REFERENCES categories(id) ON DELETE SET NULL,
      description      TEXT,
      publisher        TEXT,
      year             INTEGER,
      cover_image      TEXT,
      file_path        TEXT,
      available_copies INTEGER     NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS borrows (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id       INTEGER     NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      borrow_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_date      TIMESTAMPTZ NOT NULL,
      return_date   TIMESTAMPTZ,
      status        TEXT        NOT NULL DEFAULT 'borrowed' CHECK(status IN ('borrowed','returned','overdue')),
      renewal_count INTEGER     NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id     INTEGER     NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status      TEXT        NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','available','cancelled')),
      UNIQUE(user_id, book_id)
    );
  `);

  // Add renewal_count column to existing borrows tables (idempotent migration)
  await pool.query(`
    ALTER TABLE borrows ADD COLUMN IF NOT EXISTS renewal_count INTEGER NOT NULL DEFAULT 0;
  `);
}

function getDb() {
  return pool;
}

module.exports = { getDb, initSchema };
