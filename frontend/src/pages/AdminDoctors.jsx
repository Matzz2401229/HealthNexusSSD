import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";

export default function AdminDoctors() {

    const [pendingDoctors, setPendingDoctors] = useState([]);
    const [message, setMessage] = useState("");

    const loadData = async () => {
    try {
        const doctorsData = await apiGet("/admin/pending-doctors");
        setPendingDoctors(doctorsData || []);
    } catch {
        setMessage("Unable to load doctors.");
    }
    };

    const approveDoctor = async (id) => {
        try {
          await apiPost(`/admin/pending-doctors/${id}/approve`);
          setMessage('Doctor approved.');
          loadData();
        } catch (err) {
          setMessage(err.message || 'Unable to approve doctor.');
        }
      };

    const rejectDoctor = async (id) => {
        try {
          await apiPost(`/admin/pending-doctors/${id}/reject`);
          setMessage('Doctor rejected.');
        //   loadData();
    await loadData();
        } catch (err) {
          setMessage(err.message || 'Unable to reject doctor.');
        }
      };

    useEffect(() => {
        loadData();
    }, []);

    


    return (
        <div className="hn-page">

            <h1>Review Doctor Registrations</h1>

            {message && (
                <p>{message}</p>
            )}

        <div className="hn-card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Review doctor registrations</h3>
            {pendingDoctors.length === 0 ? <p className="hn-text-muted">No pending doctor registrations.</p> : (
            <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
                {pendingDoctors.map((doctor) => (
                <li key={doctor.id}>
                    <strong>{doctor.full_name || doctor.email}</strong> ({doctor.email})<br />
                    Specialty: {doctor.specialty || 'Not provided'}<br />
                    Registered: {doctor.created_at}
                    <div style={{ marginTop: '0.35rem' }}>
                    <button className="hn-btn hn-btn-primary" onClick={() => approveDoctor(doctor.id)} style={{ marginRight: '0.5rem' }}>Approve</button>
                    <button className="hn-btn" onClick={() => rejectDoctor(doctor.id)}>Reject</button>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>

        </div>
    );
}