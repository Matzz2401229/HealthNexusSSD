import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Login page — themed, frontend only. The submit handler is a stub; the Auth
 * & session workstream will wire this to POST /api/auth/login (with CSRF token
 * and Secure/HttpOnly cookie handling done server-side).
 */
export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO (Auth & session workstream): call the backend login endpoint.
    console.log('login submit (stub)', form.email);
  };

  return (
    <div className="hn-auth">
      {/* Left brand panel (hidden on mobile) */}
      <aside className="hn-auth__brand">
        <h1>Welcome back</h1>
        <p>Sign in to access your appointments, records, and prescriptions — securely.</p>
        <ul className="hn-auth__points">
          <li>🔒 Encrypted, role-based access to your health data</li>
          <li>📋 Every record access is logged for your safety</li>
          <li>⚕️ Trusted by patients, doctors, and pharmacists</li>
        </ul>
      </aside>

      {/* Right form */}
      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <h2 className="hn-auth__title">Sign in</h2>
          <p className="hn-auth__subtitle">Enter your credentials to continue.</p>

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

            <button type="submit" className="hn-btn hn-btn-primary hn-btn-block">Sign in</button>
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
