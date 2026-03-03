import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Home() {
  const [stats, setStats] = useState({ books: 0, categories: 0 });
  const [recentBooks, setRecentBooks] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [booksRes, catsRes] = await Promise.all([
          api.get('/books?limit=6'),
          api.get('/categories'),
        ]);
        setRecentBooks(booksRes.data.data);
        setStats({ books: booksRes.data.total, categories: catsRes.data.length });
      } catch {
        // ignore
      }
    }
    loadData();
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <h1>Perpustakaan Digital UNISMU</h1>
        <p>Temukan ribuan koleksi buku ilmiah, referensi, dan karya akademik.</p>
        <Link to="/books" className="btn-primary">
          Jelajahi Koleksi
        </Link>
      </section>

      <section className="stats">
        <div className="stat-card">
          <span className="stat-number">{stats.books}</span>
          <span className="stat-label">Total Buku</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.categories}</span>
          <span className="stat-label">Kategori</span>
        </div>
      </section>

      <section>
        <h2>Buku Terbaru</h2>
        <div className="book-grid">
          {recentBooks.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/books" className="btn-primary">
            Lihat Semua Buku
          </Link>
        </div>
      </section>
    </div>
  );
}

function BookCard({ book }) {
  return (
    <Link to={`/books/${book.id}`} className="book-card">
      <div className="book-cover">
        {book.cover_image ? (
          <img
            src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/uploads/covers/${book.cover_image}`}
            alt={book.title}
          />
        ) : (
          <div className="book-cover-placeholder">📖</div>
        )}
      </div>
      <div className="book-info">
        <h3>{book.title}</h3>
        <p className="book-author">{book.author}</p>
        {book.category_name && (
          <span className="badge">{book.category_name}</span>
        )}
        <span className={`copies ${book.available_copies > 0 ? 'available' : 'unavailable'}`}>
          {book.available_copies > 0
            ? `${book.available_copies} tersedia`
            : 'Tidak tersedia'}
        </span>
      </div>
    </Link>
  );
}
