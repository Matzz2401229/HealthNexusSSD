import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ensureCsrfToken } from '../lib/api';

async function apiFetch(url, options = {}) {
    const isUnsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase());
    const headers = {
        'Content-Type': 'application/json',
        ...(isUnsafe ? { 'x-csrf-token': await ensureCsrfToken() } : {}),
        ...options.headers,
    };
    return fetch(`/api${url}`, { ...options, headers, credentials: 'include' });
}

export default function PatientAppointments() {
    const [appointments, setAppointments] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Diagnosis modal (view) state
    const [viewingAppt, setViewingAppt] = useState(null);
    const [diagnosis, setDiagnosis] = useState([]);
    const [diagnosisState, setDiagnosisState] = useState('loading'); // loading | ready | error

    // Form state for booking - Split Date and Time
    const [bookForm, setBookForm] = useState({
        doctorId: '',
        date: '',
        time: '',
    });

    useEffect(() => {
        fetchAppointments();
        fetchDoctors();
    }, []);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/appointments/patient/history');

            // Extract the actual JSON error from your backend
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server returned ${res.status}`);
            }

            const data = await res.json();
            setAppointments(data.appointments || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctors = async () => {
        try {
            const res = await apiFetch('/appointments/patient/available-doctors');
            if (!res.ok) return;
            const data = await res.json();
            setDoctors(data.doctors || []);
        } catch (err) {
            //console.warn('Failed to fetch available doctors.');
        }
    };

    const handleBook = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        try {
            // Combine date and time pickers into ISO string
            const isoDate = new Date(`${bookForm.date}T${bookForm.time}`).toISOString();

            const res = await apiFetch('/appointments/patient/book', {
                method: 'POST',
                body: JSON.stringify({
                    doctorId: Number(bookForm.doctorId),
                    scheduledAt: isoDate,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to book appointment');

            setSuccessMsg('Appointment booked successfully!');
            setBookForm({ doctorId: '', date: '', time: '' }); // Reset form
            fetchAppointments();
        } catch (err) {
            setError(err.message);
        }
    };

    const handleCancel = async (appointmentId) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
        setError(null);
        setSuccessMsg(null);

        try {
            const res = await apiFetch(`/appointments/patient/${appointmentId}/cancel`, {
                method: 'PATCH',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to cancel appointment');

            setSuccessMsg('Appointment cancelled.');
            fetchAppointments();
        } catch (err) {
            setError(err.message);
        }
    };

    // View the doctor's diagnosis for a completed appointment (FR12). The
    // backend only returns it if this appointment belongs to the patient.
    const viewDiagnosis = async (appt) => {
        setViewingAppt(appt);
        setDiagnosis([]);
        setDiagnosisState('loading');
        try {
            const res = await apiFetch(`/appointments/patient/${appt.id}/diagnosis`);
            if (!res.ok) throw new Error('Failed to load diagnosis');
            const data = await res.json();
            setDiagnosis(data.diagnosis || []);
            setDiagnosisState('ready');
        } catch {
            setDiagnosisState('error');
        }
    };

    const closeDiagnosis = () => setViewingAppt(null);

    // get tomorrows date to match the 1 day backend validation
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    return (
        
        <div className="hn-page">
            <span className="hn-badge">Patient Portal</span>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 700, margin: '1rem 0 2rem' }}>
                My Appointments
            </h1>
            
            {error && (
                <div style={{ background: 'var(--hn-danger)', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}
            {successMsg && (
                <div style={{ background: 'var(--hn-success)', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    {successMsg}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                {/* BOOKING FORM SECTION */}
                <div className="hn-card" style={{ alignSelf: 'start' }}>
                    <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Book New Appointment</h2>
                    <form onSubmit={handleBook}>
                        <div className="hn-field">
                            <label className="hn-label" htmlFor="doctorId">Select Doctor</label>
                            <select
                                className="hn-select"
                                id="doctorId"
                                value={bookForm.doctorId}
                                onChange={(e) => setBookForm({ ...bookForm, doctorId: e.target.value })}
                                required
                            >
                                <option value="" disabled>-- Choose a Doctor --</option>
                                {doctors.map(doc => (
                                    <option key={doc.id} value={doc.id}>{doc.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="hn-field" style={{ flex: 1 }}>
                                <label className="hn-label" htmlFor="date">Date</label>
                                <input
                                    className="hn-input" type="date" id="date"
                                    min={minDate}
                                    value={bookForm.date}
                                    onChange={(e) => setBookForm({ ...bookForm, date: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="hn-field" style={{ flex: 1 }}>
                                <label className="hn-label" htmlFor="time">Time</label>
                                <input
                                    className="hn-input" type="time" id="time"
                                    value={bookForm.time}
                                    onChange={(e) => setBookForm({ ...bookForm, time: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="hn-btn hn-btn-primary hn-btn-block" style={{ marginTop: '1rem' }}>
                            Book Appointment
                        </button>
                    </form>
                </div>

                {/* APPOINTMENT HISTORY SECTION */}
                <div className="hn-card">
                    <h2 style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>Upcoming & Past Appointments</h2>

                    {loading ? (
                        <p className="hn-text-muted">Loading appointments...</p>
                    ) : appointments.length === 0 ? (
                        <p className="hn-text-muted">You have no appointments on record.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {appointments.map((appt) => {
                                const dateObj = new Date(appt.scheduled_at);
                                const isActive = appt.status === 'booked' || appt.status === 'rescheduled';

                                // lookup doctor name
                                const doc = doctors.find(d => d.id === appt.doctor_id);
                                const doctorName = doc ? doc.full_name : `Doctor (ID: ${appt.doctor_id})`;

                                return (
                                    <div key={appt.id} style={{ border: '1px solid var(--hn-border)', padding: '1rem', borderRadius: 'var(--hn-radius-sm)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <strong style={{ fontSize: '1.1rem' }}>{doctorName}</strong>
                                                <div className="hn-text-muted" style={{ margin: '0.4rem 0' }}>
                                                    📅 {dateObj.toLocaleDateString()} <br />
                                                    ⏰ {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <span className="hn-badge" style={{
                                                    background: isActive ? 'var(--hn-primary-tint)' : appt.status === 'completed' ? '#d1fae5' : '#fee2e2',
                                                    color: isActive ? 'var(--hn-primary-dark)' : appt.status === 'completed' ? '#065f46' : '#991b1b'
                                                }}>
                                                    {appt.status.toUpperCase()}
                                                </span>
                                            </div>

                                            {isActive && (
                                                <button
                                                    onClick={() => handleCancel(appt.id)}
                                                    className="hn-btn hn-btn-outline"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderColor: 'var(--hn-danger)', color: 'var(--hn-danger)' }}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                            {appt.status === 'completed' && (
                                                <button
                                                    onClick={() => viewDiagnosis(appt)}
                                                    className="hn-btn hn-btn-outline"
                                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                >
                                                    View Diagnosis
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* DIAGNOSIS MODAL (view) */}
            {viewingAppt && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="hn-card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <h3 style={{ margin: '0 0 0.5rem' }}>Diagnosis</h3>
                        <p className="hn-text-muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
                            Appointment on {new Date(viewingAppt.scheduled_at).toLocaleDateString()}
                        </p>

                        {diagnosisState === 'loading' && <p className="hn-text-muted">Loading…</p>}
                        {diagnosisState === 'error' && (
                            <p style={{ color: 'var(--hn-danger)' }}>Couldn’t load the diagnosis. Please try again.</p>
                        )}
                        {diagnosisState === 'ready' && diagnosis.length === 0 && (
                            <p className="hn-text-muted">No diagnosis has been recorded for this appointment yet.</p>
                        )}
                        {diagnosisState === 'ready' && diagnosis.map((d) => (
                            <div key={d.id} style={{ marginBottom: '0.75rem' }}>
                                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{d.remarks}</p>
                                <span className="hn-text-muted" style={{ fontSize: '0.8rem' }}>
                                    {new Date(d.created_at).toLocaleString()}
                                </span>
                            </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button type="button" onClick={closeDiagnosis} className="hn-btn hn-btn-primary">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
