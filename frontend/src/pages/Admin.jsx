import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';

export default function Admin() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [activity, setActivity] = useState({ activeSessions: 0, recentLogins: 0, flaggedEvents: 0 });
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [doctorsData, usersData, auditData, activityData, announcementsData] = await Promise.all([
        apiGet('/admin/pending-doctors'),
        apiGet('/admin/users'),
        apiGet('/admin/audit-logs'),
        apiGet('/admin/activity'),
        apiGet('/admin/announcements'),
      ]);

      setPendingDoctors(doctorsData || []);
      setUsers(usersData || []);
      setAuditLogs(auditData || []);
      setActivity(activityData || { activeSessions: 0, recentLogins: 0, flaggedEvents: 0 });
      setAnnouncements(announcementsData || []);
    } catch (err) {
      setMessage('Unable to load admin data.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const approveDoctor = async (id) => {
    try {
      await apiPost(`/admin/pending-doctors/${id}/approve`);
      setMessage('Doctor approved.');
      loadData();
    } catch (err) {
      setMessage(err.message || 'Unable to approve doctor.');
    }
  };

  const rejectDoctor = async (id) => {
    try {
      await apiPost(`/admin/pending-doctors/${id}/reject`);
      setMessage('Doctor rejected.');
    //   loadData();
    console.log("reloading data...");
await loadData();
console.log("done");
    } catch (err) {
      setMessage(err.message || 'Unable to reject doctor.');
    }
  };

  const toggleUserStatus = async (id, isActive) => {
    try {
      await apiPatch(`/admin/users/${id}/status`, { isActive: !isActive });
      setMessage('User status updated.');
      loadData();
    } catch (err) {
      setMessage(err.message || 'Unable to update user status.');
    }
  };

  const publishAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await apiPost('/admin/announcements', { title, body });
      setMessage('Announcement published.');
      setTitle('');
      setBody('');
      loadData();
    } catch (err) {
      setMessage(err.message || 'Unable to publish announcement.');
    }
  };

  return (
    <div className="hn-page">
      <span className="hn-badge">Administrator console</span>
      <h1 style={{ margin: '1rem 0 0.5rem' }}>Admin dashboard</h1>
      <p className="hn-text-muted">Review doctor registrations, manage accounts, inspect activity, and publish announcements.</p>
      {message ? <p className="hn-hint" style={{ color: 'var(--hn-success)' }}>{message}</p> : null}

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>System activity</h3>
        <ul className="hn-text-muted" style={{ paddingLeft: '1rem', lineHeight: 1.6 }}>
          <li>Active sessions: {activity.activeSessions}</li>
          <li>Recent logins (24h): {activity.recentLogins}</li>
          <li>Flagged events: {activity.flaggedEvents}</li>
        </ul>
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Review doctor registrations</h3>
        {pendingDoctors.length === 0 ? <p className="hn-text-muted">No pending doctor registrations.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {pendingDoctors.map((doctor) => (
              <li key={doctor.id}>
                <strong>{doctor.full_name || doctor.email}</strong> ({doctor.email})<br />
                Specialty: {doctor.specialty || 'Not provided'}<br />
                Registered: {doctor.created_at}
                <div style={{ marginTop: '0.35rem' }}>
                  <button className="hn-btn hn-btn-primary" onClick={() => approveDoctor(doctor.id)} style={{ marginRight: '0.5rem' }}>Approve</button>
                  <button className="hn-btn" onClick={() => rejectDoctor(doctor.id)}>Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Manage users</h3>
        {users.length === 0 ? <p className="hn-text-muted">No accounts found.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {users.map((user) => (
              <li key={user.id}>
                <strong>{user.email}</strong> — {user.role} — {user.is_active ? 'active' : 'inactive'}<br />
                Created: {user.created_at}
                <div style={{ marginTop: '0.35rem' }}>
                  <button className="hn-btn hn-btn-primary" onClick={() => toggleUserStatus(user.id, Boolean(user.is_active))}>
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Audit trail</h3>
        {auditLogs.length === 0 ? <p className="hn-text-muted">No audit events yet.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {auditLogs.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action}</strong> — {entry.result}<br />
                Target: {entry.target || 'n/a'} • {entry.created_at}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Create announcement</h3>
        <form onSubmit={publishAnnouncement}>
          <div className="hn-field">
            <label className="hn-label">Title</label>
            <input className="hn-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="hn-field">
            <label className="hn-label">Body</label>
            <textarea className="hn-input" rows="4" value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <button className="hn-btn hn-btn-primary" type="submit">Publish</button>
        </form>
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Announcements</h3>
        {announcements.length === 0 ? <p className="hn-text-muted">No announcements yet.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {announcements.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong><br />
                {item.body}<br />
                <span className="hn-text-muted">{item.created_at}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
