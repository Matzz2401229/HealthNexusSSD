import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Register page — themed, frontend only. Role select drives whether the
 * professional-credentials field shows (doctors register with a licence
 * number, FR2). Submit is a stub; the Auth & session workstream wires it to
 * POST /api/auth/register. NOTE: real password-policy enforcement is
 * server-side (FSR7) — this is only UX hinting.
 */
export default function Register() {
  const [form, setForm] = useState({
    fullName: '', email: '', role: 'patient', licence: '', password: '', confirm: '',
  });

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO (Auth & session workstream): call the backend register endpoint.
    console.log('register submit (stub)', form.email, form.role);
  };

  return (
    <div className="hn-auth">
      <aside className="hn-auth__brand">
        <h1>Join HealthNexus</h1>
        <p>Create a secure account to manage your care — or register as a healthcare professional.</p>
        <ul className="hn-auth__points">
          <li>🛡️ Your data is protected with strong encryption</li>
          <li>✅ Doctor accounts are verified by an admin before activation</li>
          <li>⚡ One account across all your care providers</li>
        </ul>
      </aside>

      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <h2 className="hn-auth__title">Create account</h2>
          <p className="hn-auth__subtitle">It only takes a minute.</p>

          <form onSubmit={onSubmit}>
            <div className="hn-field">
              <label className="hn-label" htmlFor="fullName">Full name</label>
              <input
                className="hn-input" id="fullName" name="fullName" type="text"
                placeholder="Jane Doe" value={form.fullName} onChange={update} required
              />
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="email">Email</label>
              <input
                className="hn-input" id="email" name="email" type="email"
                placeholder="you@example.com" value={form.email} onChange={update} required
              />
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="role">I am a</label>
              <select className="hn-select" id="role" name="role" value={form.role} onChange={update}>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
                <option value="pharmacist">Pharmacist</option>
              </select>
            </div>

            {/* Doctors register with a professional credential (FR2) */}
            {form.role === 'doctor' && (
              <div className="hn-field">
                <label className="hn-label" htmlFor="licence">Medical licence number</label>
                <input
                  className="hn-input" id="licence" name="licence" type="text"
                  placeholder="e.g. MCR-123456" value={form.licence} onChange={update} required
                />
                <p className="hn-hint">Your account will be reviewed by an admin before activation.</p>
              </div>
            )}

            <div className="hn-field">
              <label className="hn-label" htmlFor="password">Password</label>
              <input
                className="hn-input" id="password" name="password" type="password"
                placeholder="At least 12 characters" value={form.password} onChange={update} required
              />
              <p className="hn-hint">Use 12+ characters with upper, lower, a digit, and a special character.</p>
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="confirm">Confirm password</label>
              <input
                className="hn-input" id="confirm" name="confirm" type="password"
                placeholder="Re-enter your password" value={form.confirm} onChange={update} required
              />
            </div>

            <button type="submit" className="hn-btn hn-btn-primary hn-btn-block">Create account</button>
          </form>

          <hr className="hn-divider" />
          <p className="hn-text-muted" style={{ textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
