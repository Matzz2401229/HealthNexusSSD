import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiGet, apiPost } from '../lib/api';

/**
 * Doctor "Issue prescription" page (FR17). Loads the doctor's authorised
 * patients (GET /api/prescriptions/patients) into a dropdown so a doctor can
 * only prescribe to patients they actually treat, then posts a new prescription
 * (POST /api/prescriptions). The server re-checks the treatment relationship
 * (FSR4) and takes the doctor id from the session (FSR2) — the UI is convenience
 * only, never the security boundary. Field limits mirror the server schema.
 */
const EMPTY = { patientId: '', appointmentId: '', medication: '', dosage: '', instructions: '' };

export default function IssuePrescription() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiGet('/prescriptions/patients')
      .then((data) => {
        setPatients(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  // Load the chosen patient's appointments so the doctor can tag the prescription
  // to a specific consultation (optional — leaving it blank auto-captures the
  // most recent appointment server-side).
  useEffect(() => {
    if (!form.patientId) {
      setAppointments([]);
      return;
    }
    apiGet(`/prescriptions/appointments?patientId=${form.patientId}`)
      .then(setAppointments)
      .catch(() => setAppointments([]));
  }, [form.patientId]);

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.patientId) {
      setError('Please choose a patient.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        patientId: Number(form.patientId),
        // optional: a specific appointment; blank lets the server auto-capture
        appointmentId: form.appointmentId ? Number(form.appointmentId) : undefined,
        medication: form.medication.trim(),
        dosage: form.dosage.trim(),
        // send instructions only when provided (the field is optional server-side)
        instructions: form.instructions.trim() || undefined,
      };
      await apiPost('/prescriptions', payload);
      const patient = patients.find((p) => p.id === Number(form.patientId));
      setSuccess(`Prescription for ${patient ? patient.full_name : 'the patient'} issued.`);
      setForm(EMPTY); // clear so the doctor can issue another
    } catch (err) {
      setError(err.message || 'Could not issue the prescription. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hn-page">
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <span className="hn-badge">Doctor</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>Issue prescription</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>
        Prescribe medication for a patient you are treating.
      </p>

      {state === 'loading' && <p className="hn-text-muted">Loading…</p>}

      {state === 'error' && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
          <strong style={{ color: 'var(--hn-danger)' }}>Couldn’t load your patients.</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            Make sure you are signed in as a doctor, then refresh.
          </p>
        </div>
      )}

      {state === 'ready' && patients.length === 0 && (
        <div className="hn-card">
          <strong>No authorised patients yet.</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            You can only prescribe to patients you have a treatment relationship
            or appointment with.
          </p>
        </div>
      )}

      {state === 'ready' && patients.length > 0 && (
        <div className="hn-card" style={{ marginTop: '1.5rem' }}>
          {success && (
            <div className="hn-card" style={{ borderColor: 'var(--hn-success)', marginBottom: '1rem' }}>
              <strong style={{ color: 'var(--hn-success)' }}>✓ {success}</strong>
              <p className="hn-text-muted" style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                <Link to="/prescriptions">View prescriptions</Link>
              </p>
            </div>
          )}

          {error && (
            <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
              <span style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={onSubmit}>
            <div className="hn-field">
              <label className="hn-label" htmlFor="patientId">Patient</label>
              <select
                className="hn-select"
                id="patientId"
                name="patientId"
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value, appointmentId: '' })}
                required
              >
                <option value="">Select a patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} (#{p.id})
                  </option>
                ))}
              </select>
            </div>

            {appointments.length > 0 && (
              <div className="hn-field">
                <label className="hn-label" htmlFor="appointmentId">
                  Appointment <span className="hn-text-muted">(optional)</span>
                </label>
                <select
                  className="hn-select"
                  id="appointmentId"
                  name="appointmentId"
                  value={form.appointmentId}
                  onChange={update}
                >
                  <option value="">Most recent (auto)</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.scheduled_at).toLocaleString()} — {a.status}
                    </option>
                  ))}
                </select>
                <p className="hn-hint">Which consultation this prescription relates to.</p>
              </div>
            )}

            <div className="hn-field">
              <label className="hn-label" htmlFor="medication">Medication</label>
              <input
                className="hn-input"
                id="medication"
                name="medication"
                type="text"
                placeholder="e.g. Amoxicillin"
                value={form.medication}
                onChange={update}
                maxLength={255}
                required
              />
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="dosage">Dosage</label>
              <input
                className="hn-input"
                id="dosage"
                name="dosage"
                type="text"
                placeholder="e.g. 500mg"
                value={form.dosage}
                onChange={update}
                maxLength={255}
                required
              />
            </div>

            <div className="hn-field">
              <label className="hn-label" htmlFor="instructions">Instructions <span className="hn-text-muted">(optional)</span></label>
              <textarea
                className="hn-input"
                id="instructions"
                name="instructions"
                rows={3}
                placeholder="e.g. Take twice daily after food"
                value={form.instructions}
                onChange={update}
                maxLength={2000}
              />
            </div>

            <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" disabled={busy}>
              {busy ? 'Issuing…' : 'Issue prescription'}
            </button>
          </form>
        </div>
      )}
      </div>
    </div>
  );
}
