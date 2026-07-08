import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiPost } from '../lib/api';

/**
 * Register page — wired to the backend. The role selector picks both the
 * endpoint and the extra field:
 *   patient    → POST /api/auth/register            (+ date of birth)
 *   doctor     → POST /api/auth/register/doctor      (+ specialty)   → pending approval
 *   pharmacist → POST /api/auth/register/pharmacist  (+ pharmacy)    → pending approval
 * Password policy is hinted here for UX but enforced server-side (FSR7).
 */
function endpointAndPayload(form) {
  const base = {
    name: form.name,
    email: form.email,
    password: form.password,
    emailVerificationCode: form.emailVerificationCode,
  };
  if (form.role === 'doctor') {
    return ['/auth/register/doctor', { ...base, specialty: form.specialty || undefined }];
  }
  if (form.role === 'pharmacist') {
    return ['/auth/register/pharmacist', { ...base, pharmacy: form.pharmacy || undefined }];
  }
  return ['/auth/register', { ...base, dateOfBirth: form.dateOfBirth }];
}

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', role: 'patient',
    dateOfBirth: '', specialty: '', pharmacy: '',
    password: '', confirm: '', emailVerificationCode: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [codeMessage, setCodeMessage] = useState('');
  const [developmentCode, setDevelopmentCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const requestCode = async () => {
    setError('');
    setCodeMessage('');
    setDevelopmentCode('');

    if (!form.email) {
      setError('Enter your email before requesting a verification code.');
      return;
    }

    setCodeBusy(true);
    try {
      const data = await apiPost('/auth/registration-code', { email: form.email });
      setCodeMessage(data.message || 'Verification code sent.');
      setDevelopmentCode(data.developmentCode || '');
    } catch (err) {
      setError(err.message || 'Unable to send verification code.');
    } finally {
      setCodeBusy(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!/^\d{6}$/.test(form.emailVerificationCode)) {
      setError('Enter the 6-digit email verification code.');
      return;
    }
    setBusy(true);
    try {
      const [endpoint, payload] = endpointAndPayload(form);
      const data = await apiPost(endpoint, payload);
      setSuccess(data.message || 'Registration successful.');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hn-auth hn-auth-clinic">
      <aside className="hn-auth__brand">
        <span className="hn-auth-kicker">Start your care record</span>
        <h1>Join a clinic workspace built around patient control.</h1>
        <p>Create a secure account to manage care, records, and prescriptions.</p>
        <ul className="hn-auth__points">
          <li><span>01</span> Patient accounts can start using the portal immediately</li>
          <li><span>02</span> Doctors and pharmacists require admin verification</li>
          <li><span>03</span> Strong passwords protect clinical access</li>
        </ul>
      </aside>

      <section className="hn-auth__form">
        <div className="hn-auth__form-inner">
          <span className="hn-badge">Create secure access</span>
          <h2 className="hn-auth__title">Create account</h2>
          <p className="hn-auth__subtitle">Start as a patient, or register for staff review.</p>

          {success ? (
            <div className="hn-card" style={{ borderColor: 'var(--hn-success)' }}>
              <strong style={{ color: 'var(--hn-success)' }}>✓ {success}</strong>
              <p className="hn-text-muted" style={{ margin: '0.75rem 0 0' }}>
                <Link to="/login">Go to sign in →</Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{error}</span>
                </div>
              )}

              <form onSubmit={onSubmit}>
                <div className="hn-field">
                  <label className="hn-label" htmlFor="name">Full name</label>
                  <input className="hn-input" id="name" name="name" type="text"
                    placeholder="Jane Doe" value={form.name} onChange={update} required />
                </div>

                <div className="hn-field">
                  <label className="hn-label" htmlFor="email">Email</label>
                  <input className="hn-input" id="email" name="email" type="email"
                    placeholder="you@example.com" value={form.email} onChange={update} required />
                </div>

                <div className="hn-field">
                  <label className="hn-label" htmlFor="emailVerificationCode">Email verification</label>
                  <div className="hn-code-row">
                    <input
                      className="hn-input"
                      id="emailVerificationCode"
                      name="emailVerificationCode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength="6"
                      placeholder="6-digit code"
                      value={form.emailVerificationCode}
                      onChange={update}
                      required
                    />
                    <button className="hn-btn hn-btn-outline" type="button" onClick={requestCode} disabled={codeBusy}>
                      {codeBusy ? 'Sending…' : 'Send code'}
                    </button>
                  </div>
                  <p className="hn-hint">
                    We send a code to confirm this email before creating the account.
                  </p>
                  {codeMessage ? <p className="hn-hint" style={{ color: 'var(--hn-success)' }}>{codeMessage}</p> : null}
                  {developmentCode ? (
                    <p className="hn-hint">Development code: <strong>{developmentCode}</strong></p>
                  ) : null}
                </div>

                <div className="hn-field">
                  <label className="hn-label" htmlFor="role">I am a</label>
                  <select className="hn-select" id="role" name="role" value={form.role} onChange={update}>
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                    <option value="pharmacist">Pharmacist</option>
                  </select>
                </div>

                {form.role === 'patient' && (
                  <div className="hn-field">
                    <label className="hn-label" htmlFor="dateOfBirth">Date of birth</label>
                    <input className="hn-input" id="dateOfBirth" name="dateOfBirth" type="date"
                      value={form.dateOfBirth} onChange={update} required />
                  </div>
                )}

                {form.role === 'doctor' && (
                  <div className="hn-field">
                    <label className="hn-label" htmlFor="specialty">Specialty</label>
                    <input className="hn-input" id="specialty" name="specialty" type="text"
                      placeholder="e.g. Cardiology" value={form.specialty} onChange={update} />
                    <p className="hn-hint">Your account will be reviewed by an admin before activation.</p>
                  </div>
                )}

                {form.role === 'pharmacist' && (
                  <div className="hn-field">
                    <label className="hn-label" htmlFor="pharmacy">Pharmacy</label>
                    <input className="hn-input" id="pharmacy" name="pharmacy" type="text"
                      placeholder="e.g. Central Pharmacy" value={form.pharmacy} onChange={update} />
                    <p className="hn-hint">Your account will be reviewed by an admin before activation.</p>
                  </div>
                )}

                <div className="hn-field">
                  <label className="hn-label" htmlFor="password">Password</label>
                  <input className="hn-input" id="password" name="password" type="password"
                    placeholder="At least 12 characters" value={form.password} onChange={update} required />
                  <p className="hn-hint">Use 12+ characters with upper, lower, a digit, and a special character.</p>
                </div>

                <div className="hn-field">
                  <label className="hn-label" htmlFor="confirm">Confirm password</label>
                  <input className="hn-input" id="confirm" name="confirm" type="password"
                    placeholder="Re-enter your password" value={form.confirm} onChange={update} required />
                </div>

                <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
                  {busy ? 'Creating account…' : 'Create account'}
                </button>
              </form>

              <hr className="hn-divider" />
              <p className="hn-text-muted" style={{ textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
                Already have an account? <Link to="/login">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
