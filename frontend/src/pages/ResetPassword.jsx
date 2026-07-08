import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiPost } from '../lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }

    try {
      const data = await apiPost('/auth/reset-password', {
        token,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setMessage(data.message || 'Your password has been reset.');
      setForm({ password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hn-auth hn-auth-clinic">
      <aside className="hn-auth__brand">
        <span className="hn-auth-kicker">Set new password</span>
        <h1>Choose a new key for your clinic account.</h1>
        <p>
          Reset links expire quickly and can only be used once. After a successful
          reset, sign in again with your new password.
        </p>
        <ul className="hn-auth__points">
          <li><span>01</span> Use at least 12 characters</li>
          <li><span>02</span> Include upper, lower, number, and symbol</li>
          <li><span>03</span> Do not reuse passwords from other services</li>
        </ul>
      </aside>

      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <span className="hn-badge">Password reset</span>
          <h2 className="hn-auth__title">Create a new password</h2>
          <p className="hn-auth__subtitle">This reset link is single-use and time-limited.</p>

          {!token ? (
            <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
              <strong style={{ color: 'var(--hn-danger)' }}>Reset token missing.</strong>
              <p className="hn-text-muted" style={{ margin: '0.75rem 0 0' }}>
                Request a new reset link from the forgot password page.
              </p>
              <Link to="/forgot-password" className="hn-btn hn-btn-primary" style={{ marginTop: '1rem' }}>
                Request reset
              </Link>
            </div>
          ) : (
            <>
              {error ? (
                <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{error}</span>
                </div>
              ) : null}

              {message ? (
                <div className="hn-card" style={{ borderColor: 'var(--hn-success)', marginBottom: '1rem' }}>
                  <strong style={{ color: 'var(--hn-success)' }}>{message}</strong>
                  <p className="hn-text-muted" style={{ margin: '0.75rem 0 0' }}>
                    <Link to="/login">Go to sign in</Link>
                  </p>
                </div>
              ) : (
                <form onSubmit={onSubmit}>
                  <div className="hn-field">
                    <label className="hn-label" htmlFor="password">New password</label>
                    <input
                      className="hn-input"
                      id="password"
                      name="password"
                      type="password"
                      placeholder="At least 12 characters"
                      value={form.password}
                      onChange={update}
                      required
                    />
                    <p className="hn-hint">Use upper, lower, digit, and special character.</p>
                  </div>

                  <div className="hn-field">
                    <label className="hn-label" htmlFor="confirmPassword">Confirm new password</label>
                    <input
                      className="hn-input"
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Re-enter your password"
                      value={form.confirmPassword}
                      onChange={update}
                      required
                    />
                  </div>

                  <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
                    {busy ? 'Resetting…' : 'Reset password'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
