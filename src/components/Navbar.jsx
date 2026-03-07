import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../utils/roles';
import api from '../api';

const TYPE_ICON = {
  due_soon: '⏰',
  overdue: '🚨',
  reservation_available: '✅',
  fine: '💸',
  announcement: '📢',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(() => {
    if (!user) return;
    api
      .get('/notifications')
      .then(({ data }) => {
        setNotifications(data.notifications);
        setUnread(data.unread);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // poll every 60s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleMarkAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      // ignore
    }
  }

  async function handleMarkRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnread((prev) => {
        const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });
    } catch {
      // ignore
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">📚 Digilib UNISMU</Link>
      </div>
      <div className="navbar-menu">
        <Link to="/">Beranda</Link>
        <Link to="/books">Koleksi Buku</Link>
        {user ? (
          <>
            {isAdminRole(user.role) && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profil</Link>

            {/* Notification Bell */}
            <div className="notif-wrapper" ref={panelRef}>
              <button
                className="notif-bell"
                onClick={() => setOpen((o) => !o)}
                aria-label="Notifikasi"
                title="Notifikasi"
              >
                🔔
                {unread > 0 && (
                  <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
                )}
              </button>

              {open && (
                <div className="notif-panel">
                  <div className="notif-panel-header">
                    <span>Notifikasi</span>
                    {unread > 0 && (
                      <button className="notif-read-all" onClick={handleMarkAllRead}>
                        Tandai semua dibaca
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 ? (
                      <p className="notif-empty">Tidak ada notifikasi</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-item${n.is_read ? '' : ' notif-unread'}`}
                          onClick={() => !n.is_read && handleMarkRead(n.id)}
                        >
                          <span className="notif-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                          <div className="notif-body">
                            <p className="notif-title">{n.title}</p>
                            <p className="notif-msg">{n.message}</p>
                            <p className="notif-time">
                              {new Date(n.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <button
                            className="notif-delete"
                            onClick={(e) => handleDelete(e, n.id)}
                            title="Hapus"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleLogout} className="btn-logout">
              Keluar
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Masuk</Link>
            <Link to="/register" className="btn-register">
              Daftar
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
