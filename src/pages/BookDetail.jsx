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
  const [inWishlist, setInWishlist] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [hasBorrowed, setHasBorrowed] = useState(false);
  const [userReview, setUserReview] = useState(null);

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
        setHasBorrowed(data.some((b) => String(b.book_id) === String(id)));
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

  const fetchWishlist = useCallback(() => {
    if (!user) return;
    api
      .get('/users/me/wishlist')
      .then(({ data }) => {
        setInWishlist(data.some((w) => String(w.book_id) === String(id)));
      })
      .catch((err) => console.error('Gagal memuat wishlist:', err));
  }, [id, user]);

  const fetchReviews = useCallback(() => {
    api
      .get(`/books/${id}/reviews`)
      .then(({ data }) => {
        setReviews(data.reviews);
        setAvgRating(data.avg_rating);
        if (user) {
          const own = data.reviews.find((r) => r.user_name === user.name);
          setUserReview(own || null);
        }
      })
      .catch((err) => console.error('Gagal memuat ulasan:', err));
  }, [id, user]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  useEffect(() => {
    fetchBorrowStatus();
    fetchReservation();
    fetchWishlist();
    fetchReviews();
  }, [fetchBorrowStatus, fetchReservation, fetchWishlist, fetchReviews]);

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

  async function handleToggleWishlist() {
    try {
      if (inWishlist) {
        await api.delete(`/books/${id}/wishlist`);
        setInWishlist(false);
      } else {
        await api.post(`/books/${id}/wishlist`);
        setInWishlist(true);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    try {
      await api.post(`/books/${id}/reviews`, reviewForm);
      setReviewForm({ rating: 5, comment: '' });
      fetchReviews();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan menyimpan ulasan');
    }
  }

  async function handleDeleteReview(reviewId) {
    try {
      await api.delete(`/books/${id}/reviews/${reviewId}`);
      fetchReviews();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan menghapus ulasan');
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
  const isAdmin = user && (user.role === 'admin' || user.role === 'kepala IT');

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

          {avgRating !== null && (
            <div className="book-rating">
              <span className="stars">{renderStars(avgRating)}</span>
              <span className="rating-text">{avgRating.toFixed(1)} ({reviews.length} ulasan)</span>
            </div>
          )}

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
              <button
                onClick={handleToggleWishlist}
                className={`btn-wishlist ${inWishlist ? 'active' : ''}`}
              >
                {inWishlist ? '❤️ Hapus dari Wishlist' : '🤍 Simpan ke Wishlist'}
              </button>
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

      {/* Reviews Section */}
      <div className="reviews-section">
        <h2>Ulasan Pembaca ({reviews.length})</h2>

        {user && hasBorrowed && !userReview && (
          <form onSubmit={handleSubmitReview} className="review-form">
            <h3>Tulis Ulasan</h3>
            <div className="form-group">
              <label>Rating</label>
              <div className="star-input">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star-btn ${star <= reviewForm.rating ? 'active' : ''}`}
                    onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Komentar (opsional)</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                maxLength={1000}
                rows={3}
                placeholder="Tulis pendapat Anda tentang buku ini..."
              />
            </div>
            <button type="submit" className="btn-primary">
              Kirim Ulasan
            </button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="empty">Belum ada ulasan untuk buku ini.</p>
        ) : (
          <div className="reviews-list">
            {reviews.map((r) => (
              <div key={r.id} className="review-card">
                <div className="review-header">
                  <strong>{r.user_name}</strong>
                  <span className="stars">{renderStars(r.rating)}</span>
                  <small>{new Date(r.created_at).toLocaleDateString('id-ID')}</small>
                  {(isAdmin || (user && r.user_name === user.name)) && (
                    <button
                      className="btn-small danger"
                      onClick={() => handleDeleteReview(r.id)}
                    >
                      Hapus
                    </button>
                  )}
                </div>
                {r.comment && <p className="review-comment">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <>
      {'★'.repeat(full)}
      {half ? '½' : ''}
      {'☆'.repeat(5 - full - (half ? 1 : 0))}
    </>
  );
}
