import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

/**
 * Shared top navigation. Reflects auth state: signed-out shows Login/Register;
 * signed-in shows "Logged in as [role]" + Log out. (UI convenience only — the
 * real access control is server-side.)
 */
const ROLE_LABEL = { patient: 'Patient', doctor: 'Doctor', pharmacist: 'Pharmacist', admin: 'Admin' };

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <nav className="hn-navbar">
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
      <Link to="/" className="hn-brand" style={{ color: 'var(--hn-primary)' }}>
        <Logo />
        <span style={{ color: 'var(--hn-primary-darker)' }}>HealthNexus</span>
      </Link>


        {/* patient appointment */}
        {user && user.role === 'patient' && (
            <Link
                to="/patient/appointments"
                className={`hn-nav-item ${pathname === '/patient/appointments' ? 'active' : ''}`}
                style={{ textDecoration: 'none', color: 'var(--hn-primary-darker)', fontWeight: '500' }}
            >
                Appointments
            </Link>
        )}
        
        {/* doctor schedule */}
        {user && user.role === 'doctor' && user.status === 'active' && (
            <Link
                to="/doctor/schedule"
                className={`hn-nav-item ${pathname === '/doctor/schedule' ? 'active' : ''}`}
                style={{ textDecoration: 'none', color: 'var(--hn-primary-darker)', fontWeight: '500' }}
            >
                Schedule
            </Link>
        )}
    </div>
    
      <div className="hn-nav-links">
        {user ? (
          <>
            <Link to="/dashboard" className="hn-text-muted" style={{ fontSize: '0.9rem', marginRight: '0.5rem' }}>
              Logged in as <strong>{ROLE_LABEL[user.role] ?? user.role}</strong>
            </Link>
            <button className="hn-btn hn-btn-outline" onClick={onLogout}>Log out</button>
          </>
        ) : (
          <>
            {pathname !== '/login' && (
              <Link to="/login" className="hn-btn hn-btn-outline">Login</Link>
            )}
            {pathname !== '/register' && (
              <Link to="/register" className="hn-btn hn-btn-primary">Register</Link>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
