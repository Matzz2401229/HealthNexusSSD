import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

/**
 * Post-login landing page. Greets the user and surfaces quick-action cards for
 * their role's main features (the same destinations as the navbar links).
 * Logout lives in the navbar, so it's intentionally not repeated here.
 */
const ROLE_LABEL = {
  patient: 'Patient',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  admin: 'Admin',
};

// Quick-action cards per role. Admin has its own console and is not listed here.
const QUICK_ACTIONS = {
  patient: [
    { to: '/documents', title: 'Medical Documents', desc: 'Upload records, review access requests, and download files.' },
    { to: '/patient/appointments', title: 'Appointments', desc: 'Book, view, or cancel your appointments.' },
    { to: '/prescriptions', title: 'My Prescriptions', desc: 'View and download prescriptions issued to you.' },
  ],
  doctor: [
    { to: '/documents', title: 'Medical Documents', desc: 'Request access to patient records and review approved files.' },
    { to: '/doctor/schedule', title: 'My Schedule', desc: 'View appointments and record diagnoses.' },
    { to: '/doctor/prescriptions', title: 'My Prescriptions', desc: 'Track prescriptions you’ve issued and their status.' },
    { to: '/prescriptions/new', title: 'Issue Prescription', desc: 'Prescribe medication for a patient you treat.' },
  ],
  pharmacist: [
    { to: '/pharmacy', title: 'Fulfilment Queue', desc: 'Review and dispense pending prescriptions.' },
  ],
  admin: [
    { to: '/documents', title: 'Medical Documents', desc: 'Review access requests and open only records released for operational review.' },
    { to: '/admin', title: 'Admin Console', desc: 'Approve staff accounts and manage the platform.' },
  ],
};

export default function Dashboard() {
  const { user } = useAuth();
  const role = ROLE_LABEL[user.role] ?? user.role;
  const isPending = user.status === 'pending';
  const actions = isPending ? [] : (QUICK_ACTIONS[user.role] ?? []);
  const [announcements, setAnnouncements] = useState([]);

  const loadAnnouncements = async () => {
    try {
      const data = await apiGet("/admin/announcements");
      setAnnouncements(data || []);
    } catch (err) {
      console.log("Failed to load announcements");
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  return (
    <div className="hn-page">
      <span className="hn-badge">{role}</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>Welcome back</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>
        You&rsquo;re signed in as {role}.{actions.length > 0 ? ' Jump into your tools below.' : ''}
      </p>

      {isPending && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-warning)', marginTop: '1rem' }}>
          <strong style={{ color: 'var(--hn-warning)' }}>Account pending approval</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            An admin needs to activate your account before these features unlock.
          </p>
        </div>
      )}

      {announcements.length > 0 && (
            <div className="hn-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>Announcements</h3>

              {announcements.map((a) => (
                <div key={a.id} style={{ marginBottom: '0.75rem' }}>
                  <strong>{a.title}</strong>
                  <p className="hn-text-muted" style={{ margin: 0 }}>
                    {a.body}
                  </p>
                </div>
              ))}
            </div>
      )}

      {actions.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
          }}
        >
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="hn-card"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <h3 style={{ margin: '0 0 0.35rem', color: 'var(--hn-primary-darker)' }}>{action.title} →</h3>
              <p className="hn-text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{action.desc}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
