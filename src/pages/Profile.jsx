import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [borrows, setBorrows] = useState([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [borrowError, setBorrowError] = useState('');

  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    api
      .get('/users/me')
      .then(({ data }) => setForm((prev) => ({ ...prev, name: data.name, email: data.email })))
      .catch(() => setProfileError('Gagal memuat data profil. Silakan muat ulang halaman.'));
    api
      .get('/users/me/borrows')
      .then(({ data }) => setBorrows(data))
      .catch(() => setBorrowError('Gagal memuat riwayat peminjaman'));
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

  function handleLogout() {
    logout();
    navigate('/login');
  }

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
          <h2>Riwayat Peminjaman</h2>
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
