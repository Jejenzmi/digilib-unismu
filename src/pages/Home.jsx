import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Home() {
  const [stats, setStats] = useState({ books: 0, categories: 0 });
  const [recentBooks, setRecentBooks] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [booksRes, catsRes, announcementsRes] = await Promise.all([
          api.get('/books?limit=6'),
          api.get('/categories'),
          api.get('/announcements'),
        ]);
        setRecentBooks(booksRes.data.data);
        setStats({ books: booksRes.data.total, categories: catsRes.data.length });
        setAnnouncements(announcementsRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Gagal memuat data. Silakan coba lagi.');
      }
    }
    loadData();
  }, []);

  return (
    <div className="page">
      {error && <div className="error-msg">{error}</div>}

      {announcements.length > 0 && (
        <section className="announcements-section">
          <h2>📢 Pengumuman</h2>
          <div className="announcements-list">
            {announcements.map((a) => (
              <div key={a.id} className="announcement-card">
                <h3>{a.title}</h3>
                <p>{a.content}</p>
                <small>
                  {a.created_by_name && <span>{a.created_by_name} · </span>}
                  {new Date(a.created_at).toLocaleDateString('id-ID')}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

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
