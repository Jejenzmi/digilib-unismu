import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [borrows, setBorrows] = useState([]);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me/borrows').then(({ data }) => setBorrows(data));
  }, []);

  async function handleUpdate(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const payload = { name: form.name, email: form.email };
      if (form.password) payload.password = form.password;
      await api.put('/users/me', payload);
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
                minLength={6}
                placeholder="Password baru"
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
          {borrows.length === 0 ? (
            <p>Belum ada riwayat peminjaman.</p>
          ) : (
            <table className="borrow-table">
              <thead>
                <tr>
                  <th>Buku</th>
                  <th>Tanggal Pinjam</th>
                  <th>Jatuh Tempo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {borrows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.title}</td>
                    <td>{new Date(b.borrow_date).toLocaleDateString('id-ID')}</td>
                    <td>{new Date(b.due_date).toLocaleDateString('id-ID')}</td>
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
