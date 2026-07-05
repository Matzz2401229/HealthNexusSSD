import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

/**
 * Doctor "My Prescriptions" page (§9.8 — a doctor may view fulfilment status).
 * Lists the prescriptions this doctor has issued from GET /api/prescriptions/issued,
 * showing which patient each is for and its current fulfilment status.
 */
const FULFILMENT_LABEL = {
  pending: { text: 'Pending', color: 'var(--hn-warning)' },
  dispensed: { text: 'Dispensed', color: 'var(--hn-success)' },
  rejected: { text: 'Rejected', color: 'var(--hn-danger)' },
};

export default function DoctorPrescriptions() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    apiGet('/prescriptions/issued')
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="hn-page">
      <span className="hn-badge">Doctor</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>My prescriptions</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>
        Prescriptions you have issued, and their fulfilment status.
      </p>

      {state === 'loading' && <p className="hn-text-muted">Loading…</p>}
      {state === 'error' && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
          <strong style={{ color: 'var(--hn-danger)' }}>Couldn’t load prescriptions.</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            Make sure you are signed in as a doctor, then refresh.
          </p>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <p className="hn-text-muted">You haven’t issued any prescriptions yet.</p>
      )}

      {state === 'ready' && items.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
          {items.map((p) => {
            const f = FULFILMENT_LABEL[p.fulfilment_status] ?? { text: p.fulfilment_status, color: 'var(--hn-muted)' };
            return (
              <div className="hn-card" key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem' }}>{p.medication}</h3>
                    <p className="hn-text-muted" style={{ margin: 0 }}>{p.dosage}</p>
                    <p className="hn-text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
                      For <strong>{p.patient_name}</strong> (#{p.patient_id})
                    </p>
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
                {p.status === 'cancelled' && (
                  <p style={{ margin: '0.75rem 0 0', color: 'var(--hn-danger)', fontSize: '0.85rem' }}>
                    This prescription was cancelled.
                  </p>
                )}
                <div style={{ marginTop: '1rem' }}>
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
