import { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../lib/api';

/**
 * Pharmacist queue page (FR27/FR28). Lists prescriptions awaiting fulfilment
 * (GET /api/prescriptions/pharmacy) showing only dispensing details — no
 * diagnosis/history (FSR6) — and lets the pharmacist mark each dispensed or
 * rejected (PATCH .../fulfilment, the only field they may write).
 */
export default function PharmacyQueue() {
  const [items, setItems] = useState([]);
  const [state, setState] = useState('loading');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  function load() {
    setState('loading');
    apiGet('/prescriptions/pharmacy')
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }

  useEffect(load, []);

  async function setFulfilment(id, fulfilmentStatus) {
    setBusyId(id);
    setActionError(null);
    try {
      await apiPatch(`/prescriptions/${id}/fulfilment`, { fulfilmentStatus });
      // On success the item leaves the pending queue — reload to reflect it.
      load();
    } catch {
      setActionError('Could not update — try again.');
    } finally {
      setBusyId(null);
    }
  }

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
            Make sure you are signed in as a pharmacist, then refresh.
          </p>
        </div>
      )}

      {actionError && (
        <p style={{ color: 'var(--hn-danger)', fontSize: '0.9rem' }}>{actionError}</p>
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

              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                <button
                  className="hn-btn hn-btn-primary"
                  disabled={busyId === p.id}
                  onClick={() => setFulfilment(p.id, 'dispensed')}
                >
                  {busyId === p.id ? 'Saving…' : 'Mark dispensed'}
                </button>
                <button
                  className="hn-btn hn-btn-outline"
                  disabled={busyId === p.id}
                  onClick={() => setFulfilment(p.id, 'rejected')}
                  style={{ color: 'var(--hn-danger)', borderColor: 'var(--hn-danger)' }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
