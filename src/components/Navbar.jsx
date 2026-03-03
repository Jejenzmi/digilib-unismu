import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
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
            {user.role === 'admin' && <Link to="/admin">Admin</Link>}
            <Link to="/profile">Profil</Link>
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
