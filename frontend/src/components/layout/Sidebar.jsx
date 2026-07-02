import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/patients', label: 'Patients' },
  { to: '/appointments', label: 'Appointments' },
  { to: '/messages', label: 'Messages' },
  { to: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">H</div>
        <div>
          <h4 className="mb-0">HealthNexus</h4>
          <p className="mb-0 text-muted small">Care operations</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            end={link.to === '/'}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <Button variant="secondary" className="w-100">
          Need help?
        </Button>
      </div>
    </aside>
  );
}
