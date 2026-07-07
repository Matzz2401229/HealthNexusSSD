import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState({ activeSessions: 0, recentLogins: 0, flaggedEvents: 0 });
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const activityData = await apiGet("/admin/activity");

      setActivity(activityData);
        } catch (err) {
          setMessage('Unable to load admin data.');
        }
  };

  useEffect(() => {
    loadData();
  }, []);


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

      <div className="hn-card" style={{ marginTop: "1rem" }}>
        <h3>Administration</h3>

          <button
              className="hn-btn hn-btn-primary"
              onClick={() => navigate("/admin/doctors")}
          >
              Review Doctor Registrations
          </button>

          <button
              className="hn-btn"
              onClick={() => navigate("/admin/users")}
          >
              Manage Users
          </button>

          <button
              className="hn-btn"
              onClick={() => navigate("/admin/users/new")}
          >
              Create User
          </button>

          <button
              className="hn-btn"
              onClick={() => navigate("/admin/audit")}
          >
              Audit Logs
          </button>

          <button
              className="hn-btn"
              onClick={() => navigate("/admin/announcements")}
          >
              Announcements
          </button>
      </div>
    </div>
  );
}
