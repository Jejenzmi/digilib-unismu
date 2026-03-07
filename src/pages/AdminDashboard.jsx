import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { isAdminRole } from '../utils/roles';

export default function AdminDashboard() {
  const [books, setBooks] = useState([]);
  const [bookTotal, setBookTotal] = useState(0);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [borrows, setBorrows] = useState([]);
  const [borrowTotal, setBorrowTotal] = useState(0);
  const [borrowPage, setBorrowPage] = useState(1);
  const [borrowStatus, setBorrowStatus] = useState('');
  const [tab, setTab] = useState('books');
  const [stats, setStats] = useState(null);
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
  const [bookPage, setBookPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);

  const BOOK_ADMIN_LIMIT = 20;
  const USER_ADMIN_LIMIT = 20;
  const BORROW_LIMIT = 20;

  const fetchAdminBooks = useCallback(async (page = 1) => {
    try {
      const { data } = await api.get('/books', { params: { page, limit: BOOK_ADMIN_LIMIT } });
      setBooks(data.data);
      setBookTotal(data.total);
      setBookPage(page);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data buku');
    }
  }, []);

  const fetchAdminUsers = useCallback(async (page = 1) => {
    try {
      const { data } = await api.get('/users', { params: { page, limit: USER_ADMIN_LIMIT } });
      setUsers(data.data);
      setUserTotal(data.total);
      setUserPage(page);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data pengguna');
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [bRes, cRes, uRes] = await Promise.all([
        api.get('/books', { params: { page: 1, limit: BOOK_ADMIN_LIMIT } }),
        api.get('/categories'),
        api.get('/users', { params: { page: 1, limit: USER_ADMIN_LIMIT } }),
      ]);
      setBooks(bRes.data.data);
      setBookTotal(bRes.data.total);
      setBookPage(1);
      setCategories(cRes.data);
      setUsers(uRes.data.data);
      setUserTotal(uRes.data.total);
      setUserPage(1);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data');
    }
  }, []);

  const fetchBorrows = useCallback(async (page = 1, status = '') => {
    try {
      const params = { page, limit: BORROW_LIMIT };
      if (status) params.status = status;
      const { data } = await api.get('/users/borrows', { params });
      setBorrows(data.data);
      setBorrowTotal(data.total);
      setBorrowPage(page);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat data peminjaman');
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/stats');
      setStats(data);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal memuat statistik');
    }
  }, []);

  useEffect(() => {
    async function load() {
      await fetchAll();
    }
    load();
  }, [fetchAll]);

  useEffect(() => {
    if (tab === 'borrows') {
      async function load() {
        await fetchBorrows(1, borrowStatus);
      }
      load();
    }
    if (tab === 'stats') {
      fetchStats();
    }
    // borrowStatus intentionally omitted: status changes are handled directly
    // by the onChange handler which calls fetchBorrows itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fetchBorrows, fetchStats]);

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
      // After deletion, stay on current page (go to page-1 if current page is now empty)
      const remainingOnPage = books.length - 1;
      const targetPage = remainingOnPage === 0 && bookPage > 1 ? bookPage - 1 : bookPage;
      fetchAdminBooks(targetPage);
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
      // Stay on current page (go to page-1 if current page is now empty)
      const remainingOnPage = users.length - 1;
      const targetPage = remainingOnPage === 0 && userPage > 1 ? userPage - 1 : userPage;
      fetchAdminUsers(targetPage);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Gagal menghapus user');
    }
  }

  return (
    <div className="page">
      <h1>Dashboard Admin</h1>
      {message && <div className="alert">{message}</div>}

      <div className="tab-bar">
        {['books', 'categories', 'users', 'borrows', 'stats'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
          >
            {t === 'books'
              ? 'Buku'
              : t === 'categories'
              ? 'Kategori'
              : t === 'users'
              ? 'Pengguna'
              : t === 'borrows'
              ? 'Peminjaman'
              : 'Statistik'}
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

          <h2>Daftar Buku ({bookTotal})</h2>
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
          {bookTotal > BOOK_ADMIN_LIMIT && (
            <div className="pagination">
              {buildPageRange(bookPage, Math.ceil(bookTotal / BOOK_ADMIN_LIMIT)).map((p) =>
                typeof p === 'string' ? (
                  <span key={p} className="page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => fetchAdminBooks(p)}
                    className={`page-btn ${bookPage === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          )}
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
        <>
          <h2>Daftar Pengguna ({userTotal})</h2>
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
          {userTotal > USER_ADMIN_LIMIT && (
            <div className="pagination">
              {buildPageRange(userPage, Math.ceil(userTotal / USER_ADMIN_LIMIT)).map((p) =>
                typeof p === 'string' ? (
                  <span key={p} className="page-ellipsis">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => fetchAdminUsers(p)}
                    className={`page-btn ${userPage === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          )}
        </>
      )}

      {tab === 'borrows' && (
        <>
          <div className="admin-filter-bar">
            <label>Filter Status: </label>
            <select
              value={borrowStatus}
              onChange={(e) => {
                setBorrowStatus(e.target.value);
                fetchBorrows(1, e.target.value);
              }}
            >
              <option value="">Semua</option>
              <option value="borrowed">Dipinjam</option>
              <option value="overdue">Terlambat</option>
              <option value="returned">Dikembalikan</option>
            </select>
          </div>
          <h2>Daftar Peminjaman ({borrowTotal})</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Peminjam</th>
                <th>Buku</th>
                <th>Tgl Pinjam</th>
                <th>Jatuh Tempo</th>
                <th>Tgl Kembali</th>
                <th>Status</th>
                <th>Denda</th>
              </tr>
            </thead>
            <tbody>
              {borrows.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div>{b.user_name}</div>
                    <small>{b.user_email}</small>
                  </td>
                  <td>
                    <Link to={`/books/${b.book_id}`}>{b.book_title}</Link>
                    <div><small>{b.book_author}</small></div>
                  </td>
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
                </tr>
              ))}
              {borrows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center' }}>Tidak ada data peminjaman.</td>
                </tr>
              )}
            </tbody>
          </table>
          {borrowTotal > BORROW_LIMIT && (
            <div className="pagination">
              {Array.from({ length: Math.ceil(borrowTotal / BORROW_LIMIT) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => fetchBorrows(p, borrowStatus)}
                  className={`page-btn ${borrowPage === p ? 'active' : ''}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'stats' && (
        <div className="stats-tab">
          {!stats ? (
            <div className="loading">Memuat statistik...</div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-number">{stats.total_books}</span>
                  <span className="stat-label">Total Buku</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{stats.total_categories}</span>
                  <span className="stat-label">Kategori</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{stats.total_users}</span>
                  <span className="stat-label">Pengguna</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number">{stats.total_borrows}</span>
                  <span className="stat-label">Total Peminjaman</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number stat-active">{stats.active_borrows}</span>
                  <span className="stat-label">Sedang Dipinjam</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number stat-overdue">{stats.overdue_borrows}</span>
                  <span className="stat-label">Terlambat</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number stat-returned">{stats.returned_borrows}</span>
                  <span className="stat-label">Dikembalikan</span>
                </div>
                <div className="stat-card">
                  <span className="stat-number stat-fine">
                    Rp{stats.total_fines.toLocaleString('id-ID')}
                  </span>
                  <span className="stat-label">Total Akumulasi Denda</span>
                </div>
              </div>

              {stats.top_books.length > 0 && (
                <div className="stats-section">
                  <h2>📚 Buku Terpopuler</h2>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Judul</th>
                        <th>Penulis</th>
                        <th>Jumlah Dipinjam</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top_books.map((book, idx) => (
                        <tr key={book.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <Link to={`/books/${book.id}`}>{book.title}</Link>
                          </td>
                          <td>{book.author}</td>
                          <td>{book.borrow_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {stats.borrows_by_month.length > 0 && (
                <div className="stats-section">
                  <h2>📅 Peminjaman 6 Bulan Terakhir</h2>
                  <div className="bar-chart">
                    {stats.borrows_by_month.map((item) => {
                      const maxCount = Math.max(...stats.borrows_by_month.map((i) => i.count), 1);
                      const heightPct = Math.round((item.count / maxCount) * 100);
                      return (
                        <div key={item.month} className="bar-item">
                          <div className="bar-fill" style={{ height: `${heightPct}%` }}>
                            <span className="bar-value">{item.count}</span>
                          </div>
                          <span className="bar-label">{item.month}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
