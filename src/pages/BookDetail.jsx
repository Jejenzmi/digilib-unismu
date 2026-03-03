import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function BookDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .get(`/books/${id}`)
      .then(({ data }) => setBook(data))
      .catch(() => navigate('/books'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleBorrow() {
    try {
      const { data } = await api.post(`/books/${id}/borrow`);
      setMessage(data.message);
      setBook((b) => ({ ...b, available_copies: b.available_copies - 1 }));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  async function handleReturn() {
    try {
      const { data } = await api.post(`/books/${id}/return`);
      setMessage(data.message);
      setBook((b) => ({ ...b, available_copies: b.available_copies + 1 }));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  if (loading) return <div className="loading">Memuat...</div>;
  if (!book) return null;

  const coverBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  return (
    <div className="page book-detail">
      <button className="btn-back" onClick={() => navigate(-1)}>
        ← Kembali
      </button>

      <div className="book-detail-content">
        <div className="book-detail-cover">
          {book.cover_image ? (
            <img src={`${coverBase}/uploads/covers/${book.cover_image}`} alt={book.title} />
          ) : (
            <div className="book-cover-placeholder large">📖</div>
          )}
        </div>

        <div className="book-detail-info">
          <h1>{book.title}</h1>
          <p className="book-author">oleh {book.author}</p>
          {book.category_name && <span className="badge">{book.category_name}</span>}

          <table className="book-meta">
            <tbody>
              {book.isbn && (
                <tr>
                  <td>ISBN</td>
                  <td>{book.isbn}</td>
                </tr>
              )}
              {book.publisher && (
                <tr>
                  <td>Penerbit</td>
                  <td>{book.publisher}</td>
                </tr>
              )}
              {book.year && (
                <tr>
                  <td>Tahun</td>
                  <td>{book.year}</td>
                </tr>
              )}
              <tr>
                <td>Ketersediaan</td>
                <td>
                  <span
                    className={`copies ${book.available_copies > 0 ? 'available' : 'unavailable'}`}
                  >
                    {book.available_copies > 0
                      ? `${book.available_copies} eksemplar tersedia`
                      : 'Tidak tersedia'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          {book.description && <p className="book-description">{book.description}</p>}

          {message && <div className="alert">{message}</div>}

          {user && (
            <div className="book-actions">
              <button
                onClick={handleBorrow}
                disabled={book.available_copies < 1}
                className="btn-primary"
              >
                Pinjam Buku
              </button>
              <button onClick={handleReturn} className="btn-secondary">
                Kembalikan Buku
              </button>
            </div>
          )}

          {!user && (
            <p className="login-prompt">
              <a href="/login">Masuk</a> untuk meminjam buku ini.
            </p>
          )}

          {book.file_path && (
            <a
              href={`${coverBase}/uploads/files/${book.file_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              📄 Unduh PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
