import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('books');
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    isbn: '',
    category_id: '',
    description: '',
    publisher: '',
    year: '',
    available_copies: 1,
  });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, cRes, uRes] = await Promise.all([
        api.get('/books?limit=100'),
        api.get('/categories'),
        api.get('/users'),
      ]);
      setBooks(bRes.data.data);
      setCategories(cRes.data);
      setUsers(uRes.data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [bRes, cRes, uRes] = await Promise.all([
          api.get('/books?limit=100'),
          api.get('/categories'),
          api.get('/users'),
        ]);
        if (!cancelled) {
          setBooks(bRes.data.data);
          setCategories(cRes.data);
          setUsers(uRes.data.data);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err.response?.data?.message || 'Gagal memuat data');
        }
      }
    }
    loadInitialData();
    return () => { cancelled = true; };
  }, []);

  async function handleBookSubmit(e) {
    e.preventDefault();
    setMessage('');
    try {
      if (editId) {
        await api.put(`/books/${editId}`, bookForm);
        setMessage('Buku berhasil diperbarui');
      } else {
        await api.post('/books', bookForm);
        setMessage('Buku berhasil ditambahkan');
      }
      setBookForm({
        title: '', author: '', isbn: '', category_id: '', description: '',
        publisher: '', year: '', available_copies: 1,
      });
      setEditId(null);
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Terjadi kesalahan');
    }
  }

  function editBook(book) {
    setEditId(book.id);
    setBookForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      category_id: book.category_id || '',
      description: book.description || '',
      publisher: book.publisher || '',
      year: book.year || '',
      available_copies: book.available_copies,
    });
    setTab('books');
    window.scrollTo(0, 0);
  }

  async function deleteBook(id) {
    if (!confirm('Hapus buku ini?')) return;
    try {
      await api.delete(`/books/${id}`);
      setMessage('Buku dihapus');
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus buku');
    }
  }

  async function handleCatSubmit(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.post('/categories', catForm);
      setMessage('Kategori ditambahkan');
      setCatForm({ name: '', description: '' });
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menambahkan kategori');
    }
  }

  async function deleteCat(id) {
    if (!confirm('Hapus kategori ini?')) return;
    try {
      await api.delete(`/categories/${id}`);
      setMessage('Kategori dihapus');
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus kategori');
    }
  }

  async function deleteUser(id) {
    if (!confirm('Hapus user ini?')) return;
    try {
      await api.delete(`/users/${id}`);
      setMessage('User dihapus');
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus user');
    }
  }

  return (
    <div className="page">
      <h1>Dashboard Admin</h1>
      {message && <div className="alert">{message}</div>}

      <div className="tab-bar">
        {['books', 'categories', 'users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
          >
            {t === 'books' ? 'Buku' : t === 'categories' ? 'Kategori' : 'Pengguna'}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <>
          <div className="admin-form-card">
            <h2>{editId ? 'Edit Buku' : 'Tambah Buku'}</h2>
            <form onSubmit={handleBookSubmit} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Judul *</label>
                  <input
                    value={bookForm.title}
                    onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Penulis *</label>
                  <input
                    value={bookForm.author}
                    onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>ISBN</label>
                  <input
                    value={bookForm.isbn}
                    onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Kategori</label>
                  <select
                    value={bookForm.category_id}
                    onChange={(e) => setBookForm({ ...bookForm, category_id: e.target.value })}
                  >
                    <option value="">-- Pilih Kategori --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Penerbit</label>
                  <input
                    value={bookForm.publisher}
                    onChange={(e) => setBookForm({ ...bookForm, publisher: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Tahun</label>
                  <input
                    type="number"
                    value={bookForm.year}
                    onChange={(e) => setBookForm({ ...bookForm, year: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Jumlah Eksemplar</label>
                  <input
                    type="number"
                    min="0"
                    value={bookForm.available_copies}
                    onChange={(e) =>
                      setBookForm({ ...bookForm, available_copies: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Deskripsi</label>
                <textarea
                  value={bookForm.description}
                  onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editId ? 'Perbarui' : 'Tambah'} Buku
                </button>
                {editId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditId(null);
                      setBookForm({
                        title: '', author: '', isbn: '', category_id: '',
                        description: '', publisher: '', year: '', available_copies: 1,
                      });
                    }}
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          <h2>Daftar Buku ({books.length})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Judul</th>
                <th>Penulis</th>
                <th>Kategori</th>
                <th>Tersedia</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link to={`/books/${b.id}`}>{b.title}</Link>
                  </td>
                  <td>{b.author}</td>
                  <td>{b.category_name || '-'}</td>
                  <td>{b.available_copies}</td>
                  <td>
                    <button className="btn-small" onClick={() => editBook(b)}>
                      Edit
                    </button>
                    <button className="btn-small danger" onClick={() => deleteBook(b.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'categories' && (
        <>
          <div className="admin-form-card">
            <h2>Tambah Kategori</h2>
            <form onSubmit={handleCatSubmit} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nama *</label>
                  <input
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Deskripsi</label>
                  <input
                    value={catForm.description}
                    onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">
                Tambah Kategori
              </button>
            </form>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Deskripsi</th>
                <th>Jumlah Buku</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.description || '-'}</td>
                  <td>{c.book_count}</td>
                  <td>
                    <button className="btn-small danger" onClick={() => deleteCat(c.id)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'users' && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Bergabung</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`badge ${u.role}`}>{u.role}</span>
                </td>
                <td>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                <td>
                  {u.role !== 'admin' && (
                    <button className="btn-small danger" onClick={() => deleteUser(u.id)}>
                      Hapus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
