import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Books() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);

  const LIMIT = 12;

  const fetchBooks = useCallback(async (pg = 1, q = '', cat = '') => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (q) params.search = q;
      if (cat) params.category_id = cat;
      const { data } = await api.get('/books', { params });
      setBooks(data.data);
      setTotal(data.total);
      setPage(pg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data));
    fetchBooks();
  }, [fetchBooks]);

  function handleSearch(e) {
    e.preventDefault();
    fetchBooks(1, search, categoryId);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page">
      <h1>Koleksi Buku</h1>

      <form onSubmit={handleSearch} className="search-bar">
        <input
          type="text"
          placeholder="Cari judul, penulis, atau ISBN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Cari
        </button>
      </form>

      {loading ? (
        <div className="loading">Memuat buku...</div>
      ) : books.length === 0 ? (
        <p className="empty">Tidak ada buku ditemukan.</p>
      ) : (
        <>
          <p className="result-count">{total} buku ditemukan</p>
          <div className="book-grid">
            {books.map((book) => (
              <Link key={book.id} to={`/books/${book.id}`} className="book-card">
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
                  {book.category_name && <span className="badge">{book.category_name}</span>}
                  <span
                    className={`copies ${book.available_copies > 0 ? 'available' : 'unavailable'}`}
                  >
                    {book.available_copies > 0
                      ? `${book.available_copies} tersedia`
                      : 'Tidak tersedia'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="pagination">
            {buildPageRange(page, totalPages).map((p) =>
              typeof p === 'string' ? (
                <span key={p} className="page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => fetchBooks(p, search, categoryId)}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...-before');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('...-after');
  pages.push(total);
  return pages;
}
