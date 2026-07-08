import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const updatePassword = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function requestCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    setDevelopmentCode('');
    setResetToken('');

    try {
      const data = await apiPost('/auth/forgot-password', { email });
      setMessage(data.message || 'If an account exists, a verification code has been sent.');
      setDevelopmentCode(data.developmentCode || '');
    } catch (err) {
      setError(err.message || 'Unable to process reset request.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const data = await apiPost('/auth/verify-reset-code', { email, code });
      setResetToken(data.resetToken);
      setMessage('Code verified. Choose a new password below.');
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(e) {
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
        token: resetToken,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      setMessage(data.message || 'Your password has been reset.');
      setForm({ password: '', confirmPassword: '' });
      setCode('');
      setResetToken('');
    } catch (err) {
      setError(err.message || 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hn-auth hn-auth-clinic">
      <aside className="hn-auth__brand">
        <span className="hn-auth-kicker">Account recovery</span>
        <h1>Reset access with an email verification code.</h1>
        <p>
          We verify your inbox first, then allow a password reset using a
          short-lived, single-use reset token.
        </p>
        <ul className="hn-auth__points">
          <li><span>01</span> Request a code using your account email</li>
          <li><span>02</span> Enter the 6-digit code from your inbox</li>
          <li><span>03</span> Set a strong new password and sign in again</li>
        </ul>
      </aside>

      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <span className="hn-badge">Forgot password</span>
          <h2 className="hn-auth__title">Recover your account</h2>
          <p className="hn-auth__subtitle">
            Enter your email and verification code before resetting your password.
          </p>

          {error ? (
            <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{error}</span>
            </div>
          ) : null}

          {message ? (
            <div className="hn-card" style={{ borderColor: 'var(--hn-success)', padding: '1rem', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--hn-success)' }}>{message}</strong>
              {developmentCode ? (
                <p className="hn-hint" style={{ marginTop: '0.75rem' }}>
                  Development code: <strong>{developmentCode}</strong>
                </p>
              ) : null}
            </div>
          ) : null}

          {!resetToken ? (
            <>
              <form onSubmit={requestCode}>
                <div className="hn-field">
                  <label className="hn-label" htmlFor="email">Email</label>
                  <input
                    className="hn-input"
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
                  {busy ? 'Sending…' : 'Send verification code'}
                </button>
              </form>

              <form onSubmit={verifyCode} style={{ marginTop: '1rem' }}>
                <div className="hn-field">
                  <label className="hn-label" htmlFor="code">Verification code</label>
                  <input
                    className="hn-input"
                    id="code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength="6"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="hn-btn hn-btn-outline hn-btn-block" disabled={busy || !email}>
                  Verify code
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={resetPassword}>
              <div className="hn-field">
                <label className="hn-label" htmlFor="password">New password</label>
                <input
                  className="hn-input"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 12 characters"
                  value={form.password}
                  onChange={updatePassword}
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
                  onChange={updatePassword}
                  required
                />
              </div>

              <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
                {busy ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}

          <hr className="hn-divider" />
          <p className="hn-text-muted" style={{ textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
