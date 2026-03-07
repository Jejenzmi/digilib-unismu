import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function BookDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isBorrowing, setIsBorrowing] = useState(false);
  const [reservation, setReservation] = useState(null); // null | { status }

  const fetchBook = useCallback(() => {
    return api
      .get(`/books/${id}`)
      .then(({ data }) => setBook(data))
      .catch(() => navigate('/books'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const fetchBorrowStatus = useCallback(() => {
    if (!user) return;
    api
      .get('/users/me/borrows')
      .then(({ data }) => {
        const active = data.some(
          (b) => String(b.book_id) === String(id) && (b.status === 'borrowed' || b.status === 'overdue')
        );
        setIsBorrowing(active);
      })
      .catch((err) => console.error('Gagal memuat status peminjaman:', err));
  }, [id, user]);

  const fetchReservation = useCallback(() => {
    if (!user) return;
    api
      .get('/users/me/reservations')
      .then(({ data }) => {
        const res = data.find((r) => String(r.book_id) === String(id));
        setReservation(res || null);
      })
      .catch((err) => console.error('Gagal memuat status antrian:', err));
  }, [id, user]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  useEffect(() => {
    fetchBorrowStatus();
    fetchReservation();
  }, [fetchBorrowStatus, fetchReservation]);

  async function handleBorrow() {
    try {
      const { data } = await api.post(`/books/${id}/borrow`);
      setMessage(data.message);
      // Auto-cancel reservation if user had one
      if (reservation) {
        await api.delete(`/books/${id}/reserve`).catch(() => {});
        setReservation(null);
      }
      await fetchBook();
      fetchBorrowStatus();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  async function handleReturn() {
    try {
      const { data } = await api.post(`/books/${id}/return`);
      setMessage(data.message);
      await fetchBook();
      fetchBorrowStatus();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  async function handleReserve() {
    try {
      const { data } = await api.post(`/books/${id}/reserve`);
      setMessage(data.message);
      fetchReservation();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  async function handleCancelReservation() {
    try {
      const { data } = await api.delete(`/books/${id}/reserve`);
      setMessage(data.message);
      setReservation(null);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/books');
    }
  }

  if (loading) return <div className="loading">Memuat...</div>;
  if (!book) return null;

  const coverBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  return (
    <div className="page book-detail">
      <button className="btn-back" onClick={handleBack}>
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
              {!isBorrowing && book.available_copies > 0 && (
                <button onClick={handleBorrow} className="btn-primary">
                  Pinjam Buku
                </button>
              )}
              {isBorrowing && (
                <button onClick={handleReturn} className="btn-secondary">
                  Kembalikan Buku
                </button>
              )}
              {!isBorrowing && book.available_copies < 1 && !reservation && (
                <button onClick={handleReserve} className="btn-reserve">
                  🔔 Antri / Reservasi
                </button>
              )}
              {!isBorrowing && reservation && reservation.status === 'pending' && (
                <div className="reservation-info">
                  <span className="status-badge reservation-pending">⏳ Dalam Antrian</span>
                  <button onClick={handleCancelReservation} className="btn-cancel-reserve">
                    Batalkan Antrian
                  </button>
                </div>
              )}
              {!isBorrowing && reservation && reservation.status === 'available' && (
                <div className="reservation-info">
                  <span className="status-badge reservation-available">✅ Buku Tersedia untuk Anda!</span>
                  <button onClick={handleBorrow} className="btn-primary">
                    Pinjam Sekarang
                  </button>
                  <button onClick={handleCancelReservation} className="btn-cancel-reserve">
                    Batalkan
                  </button>
                </div>
              )}
            </div>
          )}

          {!user && (
            <p className="login-prompt">
              <Link to="/login">Masuk</Link> untuk meminjam buku ini.
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
