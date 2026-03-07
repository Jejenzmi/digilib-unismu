import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdminRole } from '../utils/roles';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdminRole(user.role)) return <Navigate to="/" replace />;

  return children;
}
