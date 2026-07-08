import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Login page — wired to POST /api/auth/login via the auth context. On success
 * the server sets the session cookie and we redirect to the dashboard; on
 * failure we show the server's generic message (no user enumeration).
 */
export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hn-auth hn-auth-clinic">
      <aside className="hn-auth__brand">
        <span className="hn-auth-kicker">Secure patient portal</span>
        <h1>Welcome back to your digital clinic.</h1>
        <p>Sign in to manage appointments, medical documents, and prescriptions with patient-controlled sharing.</p>
        <ul className="hn-auth__points">
          <li><span>01</span> Review document access requests before sharing</li>
          <li><span>02</span> Keep prescriptions and appointments together</li>
          <li><span>03</span> Every sensitive action is audit logged</li>
        </ul>
      </aside>

      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <span className="hn-badge">Patient-friendly access</span>
          <h2 className="hn-auth__title">Sign in securely</h2>
          <p className="hn-auth__subtitle">Use your HealthNexus account to continue.</p>

          {error && (
            <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="hn-field">
              <label className="hn-label" htmlFor="email">Email</label>
              <input
                className="hn-input" id="email" name="email" type="email"
                placeholder="you@example.com" value={form.email} onChange={update} required
              />
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="password">Password</label>
              <input
                className="hn-input" id="password" name="password" type="password"
                placeholder="••••••••••••" value={form.password} onChange={update} required
              />
              <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                <Link to="/forgot-password" style={{ fontSize: '0.82rem' }}>Forgot password?</Link>
              </div>
            </div>

            <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <hr className="hn-divider" />
          <p className="hn-text-muted" style={{ textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
