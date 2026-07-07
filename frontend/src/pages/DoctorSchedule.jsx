import { useState, useEffect } from 'react';
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

export default function DoctorSchedule() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal State
    const [selectedAppt, setSelectedAppt] = useState(null);
    const [diagnosisRemarks, setDiagnosisRemarks] = useState('');
    const [tab, setTab] = useState('upcoming'); // upcoming | completed | cancelled

    useEffect(() => {
        fetchSchedule();
    }, []);

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const res = await apiFetch('/appointments/doctor/schedule');
            if (!res.ok) throw new Error('Failed to load schedule.');
            const data = await res.json();
            setAppointments(data.appointments || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (appointmentId, newStatus) => {
        if (newStatus === 'cancelled' && !window.confirm('Are you sure you want to cancel this slot?')) return;

        try {
            const res = await apiFetch(`/appointments/doctor/${appointmentId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('Failed to update status');
            fetchSchedule();
        } catch (err) {
            alert(err.message);
        }
    };

    const handleSaveDiagnosis = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch(`/appointments/doctor/${selectedAppt.id}/diagnosis`, {
                method: 'POST',
                body: JSON.stringify({ remarks: diagnosisRemarks }),
            });
            if (!res.ok) throw new Error('Failed to save diagnosis');

            // Auto-complete the appointment if diagnosis is added
            if (selectedAppt.status !== 'completed') {
                await handleStatusUpdate(selectedAppt.id, 'completed');
            }

            closeModal();
            fetchSchedule();
        } catch (err) {
            alert(err.message);
        }
    };

    const openModal = (appt) => {
        setSelectedAppt(appt);
        setDiagnosisRemarks('');
    };

    const closeModal = () => {
        setSelectedAppt(null);
        setDiagnosisRemarks('');
    };

    const groups = {
        upcoming: appointments.filter((a) => a.status === 'booked' || a.status === 'rescheduled'),
        completed: appointments.filter((a) => a.status === 'completed'),
        cancelled: appointments.filter((a) => a.status === 'cancelled'),
    };
    const TABS = [
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'completed', label: 'Completed' },
        { key: 'cancelled', label: 'Cancelled' },
    ];
    const shown = groups[tab];

    return (
        <div className="hn-page">
            <span className="hn-badge">Doctor Portal</span>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 700, margin: '1rem 0 2rem' }}>
                My Schedule
            </h1>

            {error && (
                <div style={{ background: 'var(--hn-danger)', color: '#fff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                    {error}
                </div>
            )}

            <div className="hn-card">
                {/* Status tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--hn-border)' }}>
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: tab === t.key ? '2px solid var(--hn-primary)' : '2px solid transparent',
                                color: tab === t.key ? 'var(--hn-primary-darker)' : 'var(--hn-muted)',
                                fontWeight: tab === t.key ? 600 : 500,
                                fontSize: '0.95rem',
                                padding: '0.5rem 0.9rem',
                                cursor: 'pointer',
                            }}
                        >
                            {t.label} ({groups[t.key].length})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <p className="hn-text-muted">Loading schedule...</p>
                ) : shown.length === 0 ? (
                    <p className="hn-text-muted">No {tab} appointments.</p>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {shown.map((appt) => {
                            const dateObj = new Date(appt.scheduled_at);
                            const isActive = appt.status === 'booked' || appt.status === 'rescheduled';

                            return (
                                <div key={appt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--hn-border)', padding: '1rem 1.5rem', borderRadius: 'var(--hn-radius-sm)', background: isActive ? 'var(--hn-white)' : 'var(--hn-bg)' }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>{appt.patient_name || `Patient ID: ${appt.patient_id}`}</h3>
                                        <div className="hn-text-muted">
                                            {dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <span className="hn-badge" style={{
                                            background: isActive ? 'var(--hn-primary-tint)' : appt.status === 'completed' ? '#d1fae5' : '#fee2e2',
                                            color: isActive ? 'var(--hn-primary-dark)' : appt.status === 'completed' ? '#065f46' : '#991b1b'
                                        }}>
                                            {appt.status.toUpperCase()}
                                        </span>

                                        {isActive && (
                                            <>
                                                <button
                                                    onClick={() => openModal(appt)}
                                                    className="hn-btn hn-btn-primary"
                                                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                                                >
                                                    Add Diagnosis
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                                                    className="hn-btn hn-btn-outline"
                                                    style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', borderColor: 'var(--hn-danger)', color: 'var(--hn-danger)' }}
                                                >
                                                    Cancel Slot
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* DIAGNOSIS MODAL */}
            {selectedAppt && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="hn-card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem' }}>Record Diagnosis</h3>
                        <p className="hn-text-muted" style={{ marginBottom: '1rem' }}>
                            For {selectedAppt.patient_name || `Patient ID: ${selectedAppt.patient_id}`} on {new Date(selectedAppt.scheduled_at).toLocaleDateString()}
                        </p>

                        <form onSubmit={handleSaveDiagnosis}>
                            <div className="hn-field">
                                <label className="hn-label">Clinical Remarks & Notes</label>
                                <textarea
                                    className="hn-input"
                                    rows="5"
                                    value={diagnosisRemarks}
                                    onChange={(e) => setDiagnosisRemarks(e.target.value)}
                                    placeholder="Enter diagnosis details here..."
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" onClick={closeModal} className="hn-btn hn-btn-outline">Cancel</button>
                                <button type="submit" className="hn-btn hn-btn-primary">Save & Mark Completed</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
