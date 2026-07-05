import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Gate for authenticated-only pages. While the initial /auth/me check runs we
 * show nothing; if there's no session we redirect to /login. An optional `role`
 * restricts the page to one role (wrong role → bounced to /dashboard). This is
 * a UX guard only — the real access control is enforced server-side per request.
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="hn-page">
        <p className="hn-text-muted">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
