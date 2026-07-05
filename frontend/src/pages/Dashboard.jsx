import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Post-login landing page. For now it just confirms who's logged in — real
 * role dashboards (patient/doctor/pharmacist/admin) will replace this content
 * as those workstreams land. Reached only via ProtectedRoute.
 */
const ROLE_LABEL = {
  patient: 'Patient',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  admin: 'Admin',
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="hn-page">
      <span className="hn-badge">{ROLE_LABEL[user.role] ?? user.role}</span>
      <h1 style={{ margin: '1rem 0 0.5rem' }}>
        Logged in as {ROLE_LABEL[user.role] ?? user.role}
      </h1>

      {user.status === 'pending' ? (
        <p style={{ color: 'var(--hn-warning)' }}>
          Your account is <strong>pending admin approval</strong> — some features stay
          locked until an admin activates it.
        </p>
      ) : (
        <p className="hn-text-muted">
          Your role dashboard will appear here once those features are built.
        </p>
      )}

      {user.role === 'patient' && (
        <p style={{ marginTop: '1.25rem' }}>
          <Link to="/prescriptions" className="hn-btn hn-btn-primary">View my prescriptions →</Link>
        </p>
      )}
      {user.role === 'pharmacist' && (
        <p style={{ marginTop: '1.25rem' }}>
          <Link to="/pharmacy" className="hn-btn hn-btn-primary">Go to fulfilment queue →</Link>
        </p>
      )}

      <button className="hn-btn hn-btn-outline" onClick={onLogout} style={{ marginTop: '1rem' }}>
        Log out
      </button>
    </div>
  );
}
