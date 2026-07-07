import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

const patientSteps = [
  ['Book care', 'Schedule appointments with approved doctors.'],
  ['Share records', 'Approve document access only when you choose.'],
  ['Track treatment', 'View prescriptions and visit notes in one place.'],
];

export default function Home() {
  return (
    <main className="hn-home">
      <section className="hn-home-hero">
        <div className="hn-home-copy">
          <span className="hn-badge">Private digital clinic</span>
          <h1>Care feels simpler when your health records are organised.</h1>
          <p>
            HealthNexus helps patients book appointments, manage medical documents,
            and follow prescriptions with secure access controls built in.
          </p>
          <div className="hn-home-actions">
            <Link to="/register" className="hn-btn hn-btn-primary">Create patient account</Link>
            <Link to="/login" className="hn-btn hn-btn-outline">Sign in</Link>
          </div>
        </div>

        <aside className="hn-home-clinic-card" aria-label="Clinic preview">
          <div className="hn-home-clinic-top">
            <Logo size={34} />
            <div>
              <strong>HealthNexus Clinic</strong>
              <span>Today&apos;s patient flow</span>
            </div>
          </div>
          <div className="hn-home-vitals">
            <div><span>Records</span><strong>Encrypted</strong></div>
            <div><span>Access</span><strong>Patient-led</strong></div>
            <div><span>Audits</span><strong>Logged</strong></div>
          </div>
          <div className="hn-home-appointment">
            <span>Next visit</span>
            <strong>General consultation</strong>
            <p>Bring documents, prescriptions, and appointment history together before care begins.</p>
          </div>
        </aside>
      </section>

      <section className="hn-home-strip" aria-label="Patient benefits">
        {patientSteps.map(([title, body]) => (
          <article key={title}>
            <span />
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="hn-home-grid">
        <article className="hn-card hn-home-feature-primary">
          <span className="hn-badge">For patients</span>
          <h2>You stay in control of your documents.</h2>
          <p>
            Doctors and admins request access when they need a file. You review the reason,
            approve or deny it, and can revoke approved sharing later.
          </p>
        </article>

        <article className="hn-card">
          <h3>For doctors</h3>
          <p className="hn-text-muted">
            Request patient-approved records, manage appointments, and issue prescriptions
            only within authorised care relationships.
          </p>
        </article>

        <article className="hn-card">
          <h3>For pharmacists</h3>
          <p className="hn-text-muted">
            Work from a focused fulfilment queue with prescription details and audit-backed
            dispensing decisions.
          </p>
        </article>
      </section>
    </main>
  );
}
