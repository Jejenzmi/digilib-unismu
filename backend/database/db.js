const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'digilib.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      password  TEXT    NOT NULL,
      role      TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
      created_at TEXT   NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL UNIQUE,
      description TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT    NOT NULL,
      author           TEXT    NOT NULL,
      isbn             TEXT    UNIQUE,
      category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description      TEXT,
      publisher        TEXT,
      year             INTEGER,
      cover_image      TEXT,
      file_path        TEXT,
      available_copies INTEGER NOT NULL DEFAULT 1,
      created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS borrows (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      borrow_date TEXT    NOT NULL DEFAULT (datetime('now')),
      due_date    TEXT    NOT NULL,
      return_date TEXT,
      status      TEXT    NOT NULL DEFAULT 'borrowed' CHECK(status IN ('borrowed','returned','overdue'))
    );
  `);
}

module.exports = { getDb };
