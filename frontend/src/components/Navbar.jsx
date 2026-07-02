import { Link, useLocation } from 'react-router-dom';
import Logo from './Logo';

/**
 * Shared top navigation. Appears on every page so branding stays consistent.
 * Auth links adapt to the current route (hide "Login" on the login page, etc.).
 */
export default function Navbar() {
  const { pathname } = useLocation();

  return (
    <nav className="hn-navbar">
      <Link to="/" className="hn-brand" style={{ color: 'var(--hn-primary)' }}>
        <Logo />
        <span style={{ color: 'var(--hn-primary-darker)' }}>HealthNexus</span>
      </Link>

      <div className="hn-nav-links">
        {pathname !== '/login' && (
          <Link to="/login" className="hn-btn hn-btn-outline">Login</Link>
        )}
        {pathname !== '/register' && (
          <Link to="/register" className="hn-btn hn-btn-primary">Register</Link>
        )}
      </div>
    </nav>
  );
}
