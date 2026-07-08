import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

/**
 * Shared app navigation. It keeps role links convenient, but access control
 * still belongs to the backend and protected routes.
 */
const ROLE_LABEL = { patient: 'Patient', doctor: 'Doctor', pharmacist: 'Pharmacist', admin: 'Admin' };

const NAV_LINKS = {
  patient: [
    { to: '/dashboard', label: 'Overview' },
    { to: '/documents', label: 'Documents' },
    { to: '/patient/appointments', label: 'Appointments' },
    { to: '/prescriptions', label: 'Prescriptions' },
  ],
  doctor: [
    { to: '/dashboard', label: 'Overview' },
    { to: '/documents', label: 'Documents' },
    { to: '/doctor/schedule', label: 'Schedule' },
    { to: '/doctor/prescriptions', label: 'Prescriptions' },
    { to: '/prescriptions/new', label: 'Issue Rx' },
  ],
  pharmacist: [
    { to: '/dashboard', label: 'Overview' },
    { to: '/pharmacy', label: 'Fulfilment Queue' },
  ],
  admin: [
    { to: '/dashboard', label: 'Overview' },
    { to: '/admin', label: 'Admin Console' },
    { to: '/admin/audit', label: 'Audit Logs' },
  ],
};

function navLinksFor(user) {
  if (!user) return [];
  if (user.role === 'doctor' && user.status !== 'active') {
    return [{ to: '/dashboard', label: 'Overview' }];
  }
  return NAV_LINKS[user.role] ?? [];
}

function userInitial(user) {
  return (user?.fullName || user?.email || user?.role || 'U').trim().charAt(0).toUpperCase();
}

function shouldMatchExactly(target) {
  return target === '/dashboard' || target === '/admin';
}

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  const links = navLinksFor(user);
  const homeTarget = user ? '/dashboard' : '/';
  const roleLabel = ROLE_LABEL[user?.role] ?? user?.role;
  const displayName = user?.fullName || user?.email || roleLabel || 'Signed in';

  return (
    <header className="hn-app-header">
      <nav className="hn-navbar" aria-label="Main navigation">
        <Link to={homeTarget} className="hn-brand" aria-label="HealthNexus home">
          <Logo />
          <span>HealthNexus</span>
        </Link>

        {links.length > 0 ? (
          <div className="hn-nav-primary" aria-label="Primary sections">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={shouldMatchExactly(link.to)}
                className={({ isActive }) => `hn-nav-item ${isActive ? 'active' : ''}`}
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ) : null}

        <div className="hn-nav-actions">
          {user ? (
            <>
              <Link to="/profile" className="hn-user-chip" aria-label="Open profile">
                <span className="hn-user-avatar">{userInitial(user)}</span>
                <span>
                  <strong>{displayName}</strong>
                  <small>{roleLabel ? `${roleLabel} account` : 'Signed in'}</small>
                </span>
              </Link>
              <button className="hn-btn hn-btn-outline hn-nav-logout" onClick={onLogout} type="button">
                Log out
              </button>
              <button
                className="hn-nav-menu-btn"
                onClick={() => setMenuOpen((open) => !open)}
                type="button"
                aria-controls="hn-mobile-menu"
                aria-expanded={menuOpen}
              >
                <span>{menuOpen ? 'Close' : 'Menu'}</span>
              </button>
            </>
          ) : (
            <>
              {pathname !== '/login' ? (
                <Link to="/login" className="hn-btn hn-btn-outline">Login</Link>
              ) : null}
              {pathname !== '/register' ? (
                <Link to="/register" className="hn-btn hn-btn-primary">Register</Link>
              ) : null}
            </>
          )}
        </div>
      </nav>

      {user ? (
        <div className={`hn-mobile-menu ${menuOpen ? 'open' : ''}`} id="hn-mobile-menu">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={shouldMatchExactly(link.to)}
              className={({ isActive }) => `hn-mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
          <NavLink to="/profile" className={`hn-mobile-nav-item ${pathname === '/profile' ? 'active' : ''}`}>
            Profile
          </NavLink>
          <button className="hn-mobile-nav-item danger" onClick={onLogout} type="button">
            Log out
          </button>
        </div>
      ) : null}
    </header>
  );
}
