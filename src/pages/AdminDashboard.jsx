import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { isAdminRole } from '../utils/roles';

export default function AdminDashboard() {
  const [books, setBooks] = useState([]);
  const [bookTotal, setBookTotal] = useState(0);
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
  const [editCatId, setEditCatId] = useState(null);
  const [message, setMessage] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [bookFile, setBookFile] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, cRes, uRes] = await Promise.all([
        api.get('/books?limit=100'),
        api.get('/categories'),
        api.get('/users?limit=100'),
      ]);
      setBooks(bRes.data.data);
      setBookTotal(bRes.data.total);
      setCategories(cRes.data);
      setUsers(uRes.data.data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data');
    }
  }, []);

  useEffect(() => {
    async function load() {
      await fetchAll();
    }
    load();
  }, [fetchAll]);

  async function handleBookSubmit(e) {
    e.preventDefault();
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('title', bookForm.title);
      formData.append('author', bookForm.author);
      formData.append('isbn', bookForm.isbn);
      formData.append('category_id', bookForm.category_id);
      formData.append('description', bookForm.description);
      formData.append('publisher', bookForm.publisher);
      formData.append('year', bookForm.year);
      formData.append('available_copies', bookForm.available_copies);
      if (coverFile) formData.append('cover_image', coverFile);
      if (bookFile) formData.append('file', bookFile);

      if (editId) {
        await api.put(`/books/${editId}`, formData);
        setMessage('Buku berhasil diperbarui');
      } else {
        await api.post('/books', formData);
        setMessage('Buku berhasil ditambahkan');
      }
      setBookForm({
        title: '', author: '', isbn: '', category_id: '', description: '',
        publisher: '', year: '', available_copies: 1,
      });
      setCoverFile(null);
      setBookFile(null);
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
    setCoverFile(null);
    setBookFile(null);
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
      if (editCatId) {
        await api.put(`/categories/${editCatId}`, catForm);
        setMessage('Kategori berhasil diperbarui');
      } else {
        await api.post('/categories', catForm);
        setMessage('Kategori ditambahkan');
      }
      setCatForm({ name: '', description: '' });
      setEditCatId(null);
      fetchAll();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menyimpan kategori');
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
                      setBookForm({ ...bookForm, available_copies: parseInt(e.target.value, 10) || 0 })
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
              <div className="form-row">
                <div className="form-group">
                  <label>Foto Sampul</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 20 * 1024 * 1024) {
                        setMessage('Ukuran foto sampul melebihi batas 20 MB');
                        e.target.value = '';
                        return;
                      }
                      setCoverFile(file);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>File PDF</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file && file.size > 20 * 1024 * 1024) {
                        setMessage('Ukuran file PDF melebihi batas 20 MB');
                        e.target.value = '';
                        return;
                      }
                      setBookFile(file);
                    }}
                  />
                </div>
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
                      setCoverFile(null);
                      setBookFile(null);
                    }}
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          <h2>Daftar Buku ({bookTotal > books.length ? `${books.length} dari ${bookTotal}` : books.length})</h2>
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
            <h2>{editCatId ? 'Edit Kategori' : 'Tambah Kategori'}</h2>
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
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editCatId ? 'Perbarui' : 'Tambah'} Kategori
                </button>
                {editCatId && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditCatId(null);
                      setCatForm({ name: '', description: '' });
                    }}
                  >
                    Batal
                  </button>
                )}
              </div>
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
                    <button
                      className="btn-small"
                      onClick={() => {
                        setEditCatId(c.id);
                        setCatForm({ name: c.name, description: c.description || '' });
                        window.scrollTo(0, 0);
                      }}
                    >
                      Edit
                    </button>
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
                  {!isAdminRole(u.role) && (
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
