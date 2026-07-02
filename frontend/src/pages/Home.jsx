import Logo from '../components/Logo';

/**
 * Landing page. Demonstrates the theme tokens (badge, headings, buttons,
 * cards). Use this as a reference for spacing/typography on other pages.
 */
export default function Home() {
  return (
    <div className="hn-page">
      <span className="hn-badge">Secure telemedicine &amp; EHR</span>
      <h1 style={{ fontSize: '2.4rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
        Healthcare, connected and protected.
      </h1>
      <p className="hn-text-muted" style={{ fontSize: '1.1rem', maxWidth: '38rem' }}>
        HealthNexus links patients, doctors, and pharmacists on one secure
        platform — appointments, records, and prescriptions, with privacy built in.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginTop: '3rem',
        }}
      >
        {[
          ['For patients', 'Book appointments, view diagnoses, and access prescriptions securely.'],
          ['For doctors', 'Manage schedules and authorised patient records in one place.'],
          ['For pharmacists', 'Review and fulfil prescriptions with a clear audit trail.'],
        ].map(([title, body]) => (
          <div className="hn-card" key={title}>
            <div style={{ color: 'var(--hn-primary)', marginBottom: '0.5rem' }}><Logo size={24} /></div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.4rem' }}>{title}</h3>
            <p className="hn-text-muted" style={{ margin: 0, fontSize: '0.92rem' }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
