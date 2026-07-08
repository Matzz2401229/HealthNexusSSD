import { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/**
 * Profile page (FR4). Two independent forms — profile details and change
 * password — each with its own busy/error/success state, since they hit
 * separate endpoints and one can fail without affecting the other.
 *   GET   /api/profile          → load current profile
 *   PATCH /api/profile          → update name / role-specific field
 *   PATCH /api/profile/password → change password (current-password re-check)
 * Reached only via ProtectedRoute; the server re-derives identity from the
 * session on every request regardless of what this page sends.
 */
const ROLE_FIELD = {
  patient: { key: 'dob', payloadKey: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  doctor: { key: 'specialty', payloadKey: 'specialty', label: 'Specialty', type: 'text' },
  pharmacist: { key: 'pharmacy', payloadKey: 'pharmacy', label: 'Pharmacy', type: 'text' },
  admin: null,
};

export default function Profile() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState({ fullName: '', roleField: '' });
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    apiGet('/profile')
      .then((data) => {
        setProfile(data.profile);
        const roleField = ROLE_FIELD[data.profile.role];
        setForm({
          fullName: data.profile.full_name ?? '',
          roleField: roleField ? (data.profile[roleField.key] ?? '') : '',
        });
      })
      .catch((err) => setLoadError(err.message || 'Failed to load profile.'));
  }, []);

  async function onSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileBusy(true);
    try {
      const roleField = ROLE_FIELD[profile.role];
      const payload = { fullName: form.fullName };
      if (roleField && form.roleField) {
        payload[roleField.payloadKey] = form.roleField;
      }
      const data = await apiPatch('/profile', payload);
      setProfile(data.profile);
      if (data.profile?.full_name) {
        updateUser({ fullName: data.profile.full_name });
      }
      setProfileSuccess(data.message || 'Profile updated.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const data = await apiPatch('/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess(data.message || 'Password changed successfully.');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setPwBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="hn-page">
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
          <span style={{ color: 'var(--hn-danger)' }}>{loadError}</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="hn-page">
        <p className="hn-text-muted">Loading…</p>
      </div>
    );
  }

  const roleField = ROLE_FIELD[profile.role];

  return (
    <div className="hn-page">
      <h1 style={{ margin: '0 0 0.25rem' }}>Your profile</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>{profile.email}</p>

      <div className="hn-card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Profile details</h2>

        {profileError && (
          <p style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{profileError}</p>
        )}
        {profileSuccess && (
          <p style={{ color: 'var(--hn-success)', fontSize: '0.9rem' }}>{profileSuccess}</p>
        )}

        <form onSubmit={onSaveProfile}>
          <div className="hn-field">
            <label className="hn-label" htmlFor="fullName">Full name</label>
            <input
              className="hn-input"
              id="fullName"
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>

          {roleField && (
            <div className="hn-field">
              <label className="hn-label" htmlFor="roleField">{roleField.label}</label>
              <input
                className="hn-input"
                id="roleField"
                type={roleField.type}
                value={form.roleField}
                onChange={(e) => setForm({ ...form, roleField: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="hn-btn hn-btn-primary" disabled={profileBusy}>
            {profileBusy ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      <hr className="hn-divider" />

      <div className="hn-card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginTop: 0 }}>Change password</h2>

        {pwError && <p style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{pwError}</p>}
        {pwSuccess && <p style={{ color: 'var(--hn-success)', fontSize: '0.9rem' }}>{pwSuccess}</p>}

        <form onSubmit={onChangePassword}>
          <div className="hn-field">
            <label className="hn-label" htmlFor="currentPassword">Current password</label>
            <input
              className="hn-input"
              id="currentPassword"
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              required
            />
          </div>

          <div className="hn-field">
            <label className="hn-label" htmlFor="newPassword">New password</label>
            <input
              className="hn-input"
              id="newPassword"
              type="password"
              placeholder="At least 12 characters"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required
            />
            <p className="hn-hint">Use 12+ characters with upper, lower, a digit, and a special character.</p>
          </div>

          <div className="hn-field">
            <label className="hn-label" htmlFor="confirmNewPassword">Confirm new password</label>
            <input
              className="hn-input"
              id="confirmNewPassword"
              type="password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="hn-btn hn-btn-primary" disabled={pwBusy}>
            {pwBusy ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
}
