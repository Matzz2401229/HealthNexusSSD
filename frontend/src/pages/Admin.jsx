import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../lib/api';

const DEFAULT_OVERVIEW = {
  activeSessions: 0,
  recentLogins: 0,
  flaggedEvents: 0,
  pendingDoctors: 0,
  totalUsers: 0,
  activeUsers: 0,
  pendingDocumentRequests: 0,
  latestAuditEvents: [],
  recentRegistrations: [],
};

const ACTION_LABELS = {
  login: 'User login',
  'auth.logout': 'User logout',
  'admin.create_user': 'User created',
  'admin.delete_user': 'User removed',
  'admin.reactivate_user': 'User reactivated',
  'admin.suspend_user': 'User suspended',
  'admin.list_pending_doctors': 'Doctor queue viewed',
  'admin.approve_doctor': 'Doctor approved',
  'admin.reject_doctor': 'Doctor rejected',
  'admin.create_announcement': 'Announcement published',
  'admin.update_announcement': 'Announcement updated',
  'admin.delete_announcement': 'Announcement removed',
  'document.request.create': 'Document access requested',
  'document.request.approved': 'Document request approved',
  'document.request.denied': 'Document request denied',
  'document.request.revoked': 'Document access revoked',
  'rbac.denied': 'Access denied',
  'rbac.inactive_denied': 'Inactive account blocked',
};

function formatDate(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function actionLabel(action) {
  return ACTION_LABELS[action] || action?.replaceAll('.', ' ') || 'System event';
}

function MetricCard({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className={`hn-admin-metric hn-admin-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </div>
  );
}

function ActionTile({ title, description, cta, onClick, tone = 'default' }) {
  return (
    <button className={`hn-admin-action-tile hn-admin-action-${tone}`} onClick={onClick} type="button">
      <span>{title}</span>
      <p>{description}</p>
      <strong>{cta}</strong>
    </button>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(DEFAULT_OVERVIEW);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const overviewData = await apiGet('/admin/overview');
      setOverview({ ...DEFAULT_OVERVIEW, ...overviewData });
      setMessage('');
    } catch {
      setMessage('Unable to load admin overview.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const attentionItems = useMemo(
    () => [
      {
        title: 'Doctor registrations',
        value: overview.pendingDoctors,
        description:
          overview.pendingDoctors > 0
            ? 'New clinical staff are waiting for admin review.'
            : 'No doctor registrations are waiting right now.',
        to: '/admin/doctors',
        tone: overview.pendingDoctors > 0 ? 'warning' : 'calm',
      },
      {
        title: 'Security failures',
        value: overview.flaggedEvents,
        description:
          overview.flaggedEvents > 0
            ? 'Failed or blocked events were recorded in the last 24 hours.'
            : 'No failed security events in the last 24 hours.',
        to: '/admin/audit',
        tone: overview.flaggedEvents > 0 ? 'danger' : 'calm',
      },
      {
        title: 'Document reviews',
        value: overview.pendingDocumentRequests,
        description:
          overview.pendingDocumentRequests > 0
            ? 'Document access requests are still pending patient/admin review.'
            : 'No pending document access requests.',
        to: '/documents',
        tone: overview.pendingDocumentRequests > 0 ? 'warning' : 'calm',
      },
    ],
    [overview.flaggedEvents, overview.pendingDoctors, overview.pendingDocumentRequests],
  );

  return (
    <div className="hn-page hn-admin-page">
      <section className="hn-admin-hero">
        <div>
          <span className="hn-badge">Administrator console</span>
          <h1>Admin dashboard</h1>
          <p>
            Monitor platform health, review staff access, and jump into the governance tasks
            that need attention first.
          </p>
          <div className="hn-admin-hero-actions">
            <button className="hn-btn hn-btn-primary" onClick={() => navigate('/admin/doctors')} type="button">
              Review doctors
            </button>
            <button className="hn-btn hn-btn-outline" onClick={() => navigate('/admin/audit')} type="button">
              Open audit logs
            </button>
          </div>
        </div>

        <aside className="hn-admin-hero-panel">
          <span>Operational snapshot</span>
          <strong>{overview.recentLogins}</strong>
          <p>successful logins in the last 24 hours</p>
        </aside>
      </section>

      {message ? <p className="hn-hint" style={{ color: 'var(--hn-danger)' }}>{message}</p> : null}

      <section className="hn-admin-metric-grid" aria-label="System activity summary">
        <MetricCard
          label="Active Sessions"
          value={overview.activeSessions}
          hint="Currently stored user sessions"
        />
        <MetricCard
          label="Recent Logins"
          value={overview.recentLogins}
          hint="Successful logins in 24 hours"
          tone="info"
        />
        <MetricCard
          label="Flagged Events"
          value={overview.flaggedEvents}
          hint="Failed events in 24 hours"
          tone={overview.flaggedEvents > 0 ? 'danger' : 'success'}
        />
        <MetricCard
          label="Active Users"
          value={`${overview.activeUsers}/${overview.totalUsers}`}
          hint="Enabled accounts across roles"
          tone="success"
        />
      </section>

      <section className="hn-admin-layout">
        <div className="hn-card hn-admin-section-card">
          <div className="hn-admin-section-heading">
            <div>
              <span className="hn-badge">Priority queue</span>
              <h2>Attention needed</h2>
            </div>
            <p>Start here when you log in as an administrator.</p>
          </div>

          <div className="hn-admin-attention-list">
            {attentionItems.map((item) => (
              <button
                className={`hn-admin-attention hn-admin-attention-${item.tone}`}
                key={item.title}
                onClick={() => navigate(item.to)}
                type="button"
              >
                <strong>{item.value}</strong>
                <span>{item.title}</span>
                <p>{item.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="hn-card hn-admin-section-card">
          <div className="hn-admin-section-heading">
            <div>
              <span className="hn-badge">Security</span>
              <h2>Recent activity</h2>
            </div>
            <button className="hn-btn hn-btn-outline" onClick={() => navigate('/admin/audit')} type="button">
              View all
            </button>
          </div>

          <div className="hn-admin-event-list">
            {overview.latestAuditEvents.length === 0 ? (
              <div className="hn-empty-state">No recent audit events available.</div>
            ) : (
              overview.latestAuditEvents.map((event) => (
                <div className="hn-admin-event" key={event.id}>
                  <div>
                    <strong>{actionLabel(event.action)}</strong>
                    <span>{event.target || 'No target recorded'}</span>
                  </div>
                  <div>
                    <span className={`hn-audit-result hn-audit-result-${event.result}`}>
                      {event.result}
                    </span>
                    <small>{formatDate(event.created_at)}</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="hn-card hn-admin-section-card">
        <div className="hn-admin-section-heading">
          <div>
            <span className="hn-badge">Administration</span>
            <h2>Admin tools</h2>
          </div>
          <p>Common account, audit, and communication workflows.</p>
        </div>

        <div className="hn-admin-actions-grid">
          <ActionTile
            title="Doctor Registrations"
            description="Approve or reject new doctor accounts before they can access clinical features."
            cta="Review queue"
            onClick={() => navigate('/admin/doctors')}
            tone="primary"
          />
          <ActionTile
            title="Manage Users"
            description="Suspend, reactivate, or inspect platform accounts across all roles."
            cta="Open users"
            onClick={() => navigate('/admin/users')}
          />
          <ActionTile
            title="Create User"
            description="Create patient, doctor, pharmacist, or administrator accounts for testing."
            cta="Create account"
            onClick={() => navigate('/admin/users/new')}
          />
          <ActionTile
            title="Audit Logs"
            description="Review security events, document sharing actions, and admin decisions."
            cta="Inspect logs"
            onClick={() => navigate('/admin/audit')}
          />
          <ActionTile
            title="Announcements"
            description="Publish platform messages that appear to signed-in users."
            cta="Manage posts"
            onClick={() => navigate('/admin/announcements')}
          />
        </div>
      </section>

      <section className="hn-card hn-admin-section-card">
        <div className="hn-admin-section-heading">
          <div>
            <span className="hn-badge">New accounts</span>
            <h2>Recent registrations</h2>
          </div>
          <button className="hn-btn hn-btn-outline" onClick={() => navigate('/admin/users')} type="button">
            Manage users
          </button>
        </div>

        <div className="hn-table-wrap">
          <table className="hn-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentRegistrations.length === 0 ? (
                <tr>
                  <td colSpan="4">No registrations found.</td>
                </tr>
              ) : (
                overview.recentRegistrations.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                    <td>{user.is_active ? 'Active' : 'Inactive'}</td>
                    <td>{formatDate(user.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
