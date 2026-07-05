import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function getCsrfToken() {
    const match = document.cookie.match(new RegExp('(^| )csrf_token=([^;]+)'));
    return match ? match[2] : '';
}

async function apiFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'x-csrf-token': getCsrfToken(),
        'x-mock-role': 'patient', // Tells the backend auth bypass we are a patient
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
            const res = await apiFetch('/users/doctors');
            if (!res.ok) return; // Fail silently for doctors list if endpoint missing
            const data = await res.json();
            setDoctors(data.doctors || []);
        } catch (err) {
            console.warn('Doctors API not ready yet.');
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
                                {/* Fallback mock if doctors list is empty so you can test booking */}
                                {doctors.length === 0 && <option value="2">Dr. Placeholder (ID: 2)</option>}
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

                                // Lookup doctor name
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}