import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

/**
 * Shared top navigation. Reflects auth state: signed-out shows Login/Register;
 * signed-in shows the role's quick links + "Logged in as [role]" + Log out.
 * (UI convenience only — the real access control is server-side.)
 */
const ROLE_LABEL = { patient: 'Patient', doctor: 'Doctor', pharmacist: 'Pharmacist', admin: 'Admin' };

// Per-role quick links shown in the navbar. Admin has its own console and is
// intentionally not listed here.
const NAV_LINKS = {
  patient: [
    { to: '/patient/appointments', label: 'Appointments' },
    { to: '/prescriptions', label: 'Prescriptions' },
  ],
  doctor: [
    { to: '/doctor/schedule', label: 'Schedule' },
    { to: '/doctor/prescriptions', label: 'Prescriptions' },
    { to: '/prescriptions/new', label: 'Issue Prescription' },
  ],
  pharmacist: [
    { to: '/pharmacy', label: 'Fulfilment Queue' },
  ],
};

function navLinksFor(user) {
  if (!user) return [];
  // Doctors only get clinical links once an admin has activated them.
  if (user.role === 'doctor' && user.status !== 'active') return [];
  return NAV_LINKS[user.role] ?? [];
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  const links = navLinksFor(user);

  return (
    <nav className="hn-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link to={user ? '/dashboard' : '/'} className="hn-brand" style={{ color: 'var(--hn-primary)' }}>
          <Logo />
          <span style={{ color: 'var(--hn-primary-darker)' }}>HealthNexus</span>
        </Link>

        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`hn-nav-item ${pathname === link.to ? 'active' : ''}`}
            style={{ textDecoration: 'none', color: 'var(--hn-primary-darker)', fontWeight: 500 }}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="hn-nav-links">
        {user ? (
          <>
            <Link to="/dashboard" className="hn-text-muted" style={{ fontSize: '0.9rem', marginRight: '0.5rem' }}>
              Logged in as <strong>{ROLE_LABEL[user.role] ?? user.role}</strong>
            </Link>
            <Link to="/profile" className="hn-btn hn-btn-outline" style={{ marginRight: '0.5rem' }}>Profile</Link>
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
