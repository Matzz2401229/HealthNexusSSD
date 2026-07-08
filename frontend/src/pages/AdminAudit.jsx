import { Fragment, useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';

const ACTION_LABELS = {
  login: 'User login',
  logout: 'User logout',
  'auth.logout': 'User logout',
  'admin.create_user': 'User created',
  'admin.delete_user': 'User removed',
  'admin.reactivate_user': 'User reactivated',
  'admin.suspend_user': 'User suspended',
  'admin.list_pending_doctors': 'Viewed doctor registrations',
  'admin.approve_doctor': 'Doctor approved',
  'admin.reject_doctor': 'Doctor rejected',
  'rbac.inactive_denied': 'Inactive account denied',
  'rbac.role_denied': 'Role access denied',
  'ownership.denied': 'Ownership check denied',
  'document.upload': 'Document uploaded',
  'document.delete': 'Document deleted',
  'document.download': 'Document downloaded',
  'document.preview': 'Document previewed',
  'document.request.create': 'Document access requested',
  'document.request.approved': 'Document request approved',
  'document.request.denied': 'Document request denied',
  'document.request.revoked': 'Document access revoked',
  'prescription.issue': 'Prescription issued',
  'prescription.fulfilment.update': 'Prescription fulfilled',
  'prescription.cancel': 'Prescription cancelled',
};

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function actionLabel(action) {
  return ACTION_LABELS[action] || action.replaceAll('.', ' ');
}

function eventType(action) {
  if (action.startsWith('document.')) return 'Document';
  if (action.startsWith('admin.')) return 'Admin';
  if (action.startsWith('rbac.') || action.startsWith('ownership.')) return 'Access control';
  if (action.startsWith('prescription.')) return 'Prescription';
  if (action.includes('login') || action.includes('logout')) return 'Authentication';
  return 'System';
}

function targetLabel(entry) {
  if (!entry.target) return 'None';
  if (entry.action === 'logout' || entry.action === 'auth.logout') return entry.target.replace('user:', 'User #');
  if (entry.target.startsWith('user:')) return entry.target.replace('user:', 'User #');
  if (entry.target.startsWith('doctor_registrations:')) {
    return entry.target.replace('doctor_registrations:', 'Doctor registration #');
  }
  if (entry.action.startsWith('document.request.')) return `Request #${entry.target}`;
  if (entry.action.startsWith('document.')) return `Document #${entry.target}`;
  return entry.target;
}

function resultClass(result) {
  return result === 'success' ? 'hn-audit-result-success' : 'hn-audit-result-failure';
}

function shortHash(value) {
  if (!value) return 'Genesis entry';
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="hn-card" style={{ padding: '1rem 1.15rem' }}>
      <div className="hn-text-muted" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--hn-primary-darker)' }}>{value}</div>
      <div className="hn-text-muted" style={{ marginTop: '0.2rem', fontSize: '0.86rem' }}>{hint}</div>
    </div>
  );
}

export default function AdminAudit() {
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  async function loadData() {
    try {
      setMessage('');
      const data = await apiGet('/admin/audit-logs');
      setAuditLogs(data || []);
    } catch {
      setMessage('Unable to load audit logs.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const eventTypes = useMemo(
    () => Array.from(new Set(auditLogs.map((entry) => eventType(entry.action)))).sort(),
    [auditLogs],
  );

  const roles = useMemo(
    () => Array.from(new Set(auditLogs.map((entry) => entry.role).filter(Boolean))).sort(),
    [auditLogs],
  );

  const filteredLogs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      const haystack = [
        entry.id,
        entry.user_id,
        entry.role,
        entry.action,
        actionLabel(entry.action),
        targetLabel(entry),
        entry.ip_address,
        entry.result,
      ].join(' ').toLowerCase();

      if (needle && !haystack.includes(needle)) return false;
      if (typeFilter !== 'all' && eventType(entry.action) !== typeFilter) return false;
      if (resultFilter !== 'all' && entry.result !== resultFilter) return false;
      if (roleFilter !== 'all' && entry.role !== roleFilter) return false;
      return true;
    });
  }, [auditLogs, resultFilter, roleFilter, search, typeFilter]);

  const todayCount = useMemo(() => {
    const today = new Date().toLocaleDateString('en-SG');
    return auditLogs.filter((entry) => new Date(entry.created_at).toLocaleDateString('en-SG') === today).length;
  }, [auditLogs]);

  const failureCount = auditLogs.filter((entry) => entry.result !== 'success').length;
  const documentCount = auditLogs.filter((entry) => entry.action.startsWith('document.')).length;
  const adminCount = auditLogs.filter((entry) => entry.action.startsWith('admin.')).length;

  return (
    <div className="hn-page">
      <span className="hn-badge">Administrator console</span>

      <h1 style={{ margin: '1rem 0 0.5rem' }}>Audit Logs</h1>
      <p className="hn-text-muted" style={{ marginTop: 0, maxWidth: '58rem' }}>
        Review security events, administrator actions, and sensitive document activity.
      </p>

      {message ? (
        <p className="hn-hint" style={{ color: 'var(--hn-danger)' }}>{message}</p>
      ) : null}

      <div className="hn-audit-summary-grid">
        <SummaryCard label="Events Today" value={todayCount} hint="Logged on this device date" />
        <SummaryCard label="Failed Events" value={failureCount} hint="Authentication or access failures" />
        <SummaryCard label="Document Events" value={documentCount} hint="Requests, previews, downloads" />
        <SummaryCard label="Admin Actions" value={adminCount} hint="User and platform operations" />
      </div>

      <section className="hn-card" style={{ marginTop: '1rem' }}>
        <div className="hn-audit-toolbar">
          <div className="hn-field" style={{ marginBottom: 0 }}>
            <label className="hn-label" htmlFor="audit-search">Search</label>
            <input
              id="audit-search"
              className="hn-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, target, user ID, IP, or result"
            />
          </div>

          <div className="hn-field" style={{ marginBottom: 0 }}>
            <label className="hn-label" htmlFor="audit-type">Event type</label>
            <select id="audit-type" className="hn-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              {eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div className="hn-field" style={{ marginBottom: 0 }}>
            <label className="hn-label" htmlFor="audit-result">Result</label>
            <select id="audit-result" className="hn-select" value={resultFilter} onChange={(event) => setResultFilter(event.target.value)}>
              <option value="all">All results</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </div>

          <div className="hn-field" style={{ marginBottom: 0 }}>
            <label className="hn-label" htmlFor="audit-role">Role</label>
            <select id="audit-role" className="hn-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              {roles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>
        </div>

        <div className="hn-table-wrap" style={{ marginTop: '1rem' }}>
          <table className="hn-table hn-audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Event</th>
                <th>Target</th>
                <th>Result</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <Fragment key={entry.id}>
                  <tr>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>
                      <strong>{entry.user_id ? `User #${entry.user_id}` : 'System'}</strong>
                      <br />
                      <span className="hn-text-muted">{entry.role || 'No role'}</span>
                    </td>
                    <td>
                      <strong>{actionLabel(entry.action)}</strong>
                      <br />
                      <span className="hn-text-muted">{eventType(entry.action)}</span>
                    </td>
                    <td>{targetLabel(entry)}</td>
                    <td><span className={`hn-audit-result ${resultClass(entry.result)}`}>{entry.result}</span></td>
                    <td>{entry.ip_address || 'Not captured'}</td>
                    <td>
                      <button
                        type="button"
                        className="hn-btn hn-btn-outline"
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      >
                        {expandedId === entry.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan="7">
                        <div className="hn-audit-details">
                          <div><strong>Event ID:</strong> #{entry.id}</div>
                          <div><strong>Raw action:</strong> {entry.action}</div>
                          <div><strong>Raw target:</strong> {entry.target || 'None'}</div>
                          <div><strong>Previous hash:</strong> {shortHash(entry.prev_hash)}</div>
                          <div><strong>Entry hash:</strong> {shortHash(entry.entry_hash)}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="7" className="hn-text-muted">No audit events match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
