import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';

/**
 * Pharmacist queue page (FR27). Fetches prescriptions awaiting fulfilment from
 * GET /api/prescriptions/pharmacy and shows only the dispensing details — no
 * diagnosis or medical history (FSR6). The "mark dispensed/rejected" action
 * (a write) needs CSRF handling and comes in a later step.
 */
export default function PharmacyQueue() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    apiGet('/prescriptions/pharmacy')
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="hn-page">
      <span className="hn-badge">Pharmacist</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>Fulfilment queue</h1>
      <p className="hn-text-muted" style={{ marginTop: 0 }}>
        Prescriptions waiting to be dispensed.
      </p>

      {state === 'loading' && <p className="hn-text-muted">Loading…</p>}
      {state === 'error' && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)' }}>
          <strong style={{ color: 'var(--hn-danger)' }}>Couldn’t load the queue.</strong>
          <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
            Make sure the backend is running as a pharmacist (DEV_FAKE_ROLE=pharmacist).
          </p>
        </div>
      )}

      {state === 'ready' && items.length === 0 && (
        <p className="hn-text-muted">Nothing waiting to be dispensed. 🎉</p>
      )}

      {state === 'ready' && items.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
          {items.map((p) => (
            <div className="hn-card" key={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem' }}>{p.medication}</h3>
                  <p className="hn-text-muted" style={{ margin: 0 }}>
                    {p.dosage}{p.instructions ? ` · ${p.instructions}` : ''}
                  </p>
                </div>
                <span className="hn-badge" style={{ background: 'var(--hn-primary-tint)' }}>
                  Patient #{p.patient_id}
                </span>
              </div>
              {/* TODO: "Mark dispensed / rejected" buttons — needs CSRF (next step). */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
