import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

/**
 * Patient "My Prescriptions" page (FR9). Fetches the logged-in patient's own
 * prescriptions from GET /api/prescriptions/mine and renders them with the
 * shared theme. Read-only for now; download/actions come later.
 */
const FULFILMENT_LABEL = {
  pending: { text: 'Pending', color: 'var(--hn-warning)' },
  dispensed: { text: 'Dispensed', color: 'var(--hn-success)' },
  rejected: { text: 'Rejected', color: 'var(--hn-danger)' },
};

export default function Prescriptions() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    apiGet('/prescriptions/mine')
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="hn-page">
      <span className="hn-badge">Patient</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>My prescriptions</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>
        Prescriptions issued to you by your doctors.
      </p>

      {state === 'loading' && <p className="hn-text-muted">Loading…</p>}
      {state === 'error' && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
          <strong style={{ color: 'var(--hn-danger)' }}>Couldn’t load prescriptions.</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            Make sure you are signed in as a patient, then refresh.
          </p>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <p className="hn-text-muted">You have no prescriptions yet.</p>
      )}

      {state === 'ready' && items.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
          {items.map((p) => {
            // A cancelled prescription shows "Cancelled" — not its leftover
            // fulfilment status (which stays 'pending' since it was never dispensed).
            const f = p.status === 'cancelled'
              ? { text: 'Cancelled', color: 'var(--hn-danger)' }
              : (FULFILMENT_LABEL[p.fulfilment_status] ?? { text: p.fulfilment_status, color: 'var(--hn-muted)' });
            return (
              <div className="hn-card" key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem' }}>{p.medication}</h3>
                    <p className="hn-text-muted" style={{ margin: 0 }}>{p.dosage}</p>
                    {p.instructions && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>{p.instructions}</p>
                    )}
                  </div>
                  <span
                    className="hn-badge"
                    style={{ background: 'transparent', color: f.color, border: `1px solid ${f.color}` }}
                  >
                    {f.text}
                  </span>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  {/* Same-origin GET: the session cookie is sent automatically and
                      the server checks ownership + audit-logs the download (SR17). */}
                  <a className="hn-btn hn-btn-outline" href={`/api/prescriptions/${p.id}/download`}>
                    Download
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
