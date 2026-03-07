import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [borrows, setBorrows] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [borrowError, setBorrowError] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [wishlistError, setWishlistError] = useState('');

  const [profileError, setProfileError] = useState('');

  function loadBorrows() {
    return api
      .get('/users/me/borrows')
      .then(({ data }) => setBorrows(data))
      .catch(() => setBorrowError('Gagal memuat riwayat peminjaman'));
  }

  function loadReservations() {
    return api
      .get('/users/me/reservations')
      .then(({ data }) => setReservations(data))
      .catch(() => setReservationError('Gagal memuat data antrian reservasi'));
  }

  function loadWishlist() {
    return api
      .get('/users/me/wishlist')
      .then(({ data }) => setWishlist(data))
      .catch(() => setWishlistError('Gagal memuat wishlist'));
  }

  useEffect(() => {
    api
      .get('/users/me')
      .then(({ data }) => setForm((prev) => ({ ...prev, name: data.name, email: data.email })))
      .catch(() => setProfileError('Gagal memuat data profil. Silakan muat ulang halaman.'));
    loadBorrows();
    loadReservations();
    loadWishlist();
  }, []);

  async function handleUpdate(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      const { data } = await api.put('/users/me', payload);
      updateUser(data.data);
      setForm((prev) => ({ ...prev, password: '' }));
      setMessage('Profil berhasil diperbarui');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui profil');
    }
  }

  async function handleRenew(bookId) {
    try {
      const { data } = await api.post(`/books/${bookId}/renew`);
      setMessage(data.message);
      loadBorrows();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memperpanjang peminjaman');
    }
  }

  async function handleCancelReservation(bookId) {
    try {
      const { data } = await api.delete(`/books/${bookId}/reserve`);
      setMessage(data.message);
      loadReservations();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal membatalkan antrian');
    }
  }

  async function handleRemoveWishlist(bookId) {
    try {
      await api.delete(`/books/${bookId}/wishlist`);
      loadWishlist();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus dari wishlist');
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const totalFine = borrows.reduce((sum, b) => sum + (b.fine_amount || 0), 0);
  const coverBase = import.meta.env.VITE_API_URL?.replace('/api', '') || '';

  return (
    <div className="page">
      <h1>Profil Saya</h1>

      <div className="profile-grid">
        <div className="profile-form">
          <h2>Edit Profil</h2>
          {profileError && <div className="error-msg">{profileError}</div>}
          {message && <div className="alert success">{message}</div>}
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Nama</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Password Baru (kosongkan jika tidak ingin mengubah)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                placeholder="Password baru (min. 8 karakter)"
              />
            </div>
            <button type="submit" className="btn-primary">
              Simpan Perubahan
            </button>
          </form>
          <button onClick={handleLogout} className="btn-logout" style={{ marginTop: '1rem' }}>
            Keluar
          </button>
        </div>

        <div className="borrow-history">
          {reservationError && reservations.length === 0 && (
            <p className="error-msg" style={{ marginBottom: '1rem' }}>{reservationError}</p>
          )}
          {reservations.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h2>Antrian Reservasi</h2>
              {reservationError && <p className="error-msg">{reservationError}</p>}
              <table className="borrow-table">
                <thead>
                  <tr>
                    <th>Buku</th>
                    <th>Tanggal Antri</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{new Date(r.reserved_at).toLocaleDateString('id-ID')}</td>
                      <td>
                        <span className={`status-badge reservation-${r.status}`}>
                          {r.status === 'available' ? '✅ Siap Dipinjam' : '⏳ Menunggu'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-small danger"
                          onClick={() => handleCancelReservation(r.book_id)}
                        >
                          Batalkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Wishlist Section */}
          <div style={{ marginBottom: '2rem' }}>
            <h2>❤️ Wishlist Saya</h2>
            {wishlistError && <p className="error-msg">{wishlistError}</p>}
            {wishlist.length === 0 ? (
              <p>Belum ada buku di wishlist.</p>
            ) : (
              <div className="wishlist-grid">
                {wishlist.map((w) => (
                  <div key={w.id} className="wishlist-card">
                    <Link to={`/books/${w.book_id}`} className="wishlist-cover">
                      {w.cover_image ? (
                        <img
                          src={`${coverBase}/uploads/covers/${w.cover_image}`}
                          alt={w.title}
                        />
                      ) : (
                        <div className="book-cover-placeholder">📖</div>
                      )}
                    </Link>
                    <div className="wishlist-info">
                      <Link to={`/books/${w.book_id}`}>
                        <strong>{w.title}</strong>
                      </Link>
                      <p>{w.author}</p>
                      {w.category_name && <span className="badge">{w.category_name}</span>}
                      <span className={`copies ${w.available_copies > 0 ? 'available' : 'unavailable'}`}>
                        {w.available_copies > 0 ? `${w.available_copies} tersedia` : 'Tidak tersedia'}
                      </span>
                    </div>
                    <button
                      className="btn-small danger"
                      onClick={() => handleRemoveWishlist(w.book_id)}
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <h2>Riwayat Peminjaman</h2>
          {totalFine > 0 && (
            <div className="fine-summary">
              ⚠️ Total Denda: <strong>Rp{totalFine.toLocaleString('id-ID')}</strong>
            </div>
          )}
          {borrowError ? (
            <p className="error-msg">{borrowError}</p>
          ) : borrows.length === 0 ? (
            <p>Belum ada riwayat peminjaman.</p>
          ) : (
            <table className="borrow-table">
              <thead>
                <tr>
                  <th>Buku</th>
                  <th>Tanggal Pinjam</th>
                  <th>Jatuh Tempo</th>
                  <th>Tanggal Kembali</th>
                  <th>Status</th>
                  <th>Denda</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{new Date(b.borrow_date).toLocaleDateString('id-ID')}</td>
                    <td>{new Date(b.due_date).toLocaleDateString('id-ID')}</td>
                    <td>{b.return_date ? new Date(b.return_date).toLocaleDateString('id-ID') : '-'}</td>
                    <td>
                      <span className={`status-badge ${b.status}`}>{b.status}</span>
                    </td>
                    <td>
                      {b.fine_amount > 0 ? (
                        <span className="fine-amount">Rp{b.fine_amount.toLocaleString('id-ID')}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {b.status === 'borrowed' && b.renewal_count < 1 && (
                        <button
                          className="btn-small"
                          onClick={() => handleRenew(b.book_id)}
                        >
                          Perpanjang
                        </button>
                      )}
                      {b.renewal_count >= 1 && b.status !== 'returned' && (
                        <span className="renewed-badge">Diperpanjang</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
