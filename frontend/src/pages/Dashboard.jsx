import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';

const ROLE_LABEL = {
  patient: 'Patient',
  doctor: 'Doctor',
  pharmacist: 'Pharmacist',
  admin: 'Admin',
};

const ROLE_INTRO = {
  patient: {
    eyebrow: 'Patient portal',
    title: 'Your health workspace',
    subtitle: 'Keep records, appointments, and prescriptions in one secure place.',
    spotlight: 'Care access',
  },
  doctor: {
    eyebrow: 'Clinical workspace',
    title: 'Today\'s care overview',
    subtitle: 'Review appointments, released patient documents, and prescriptions you have issued.',
    spotlight: 'Clinical queue',
  },
  pharmacist: {
    eyebrow: 'Pharmacy workspace',
    title: 'Dispensing overview',
    subtitle: 'Track pending prescriptions and update fulfilment decisions safely.',
    spotlight: 'Fulfilment',
  },
  admin: {
    eyebrow: 'Administrator workspace',
    title: 'Platform control room',
    subtitle: 'Monitor governance, staff access, security events, and platform announcements.',
    spotlight: 'Governance',
  },
};

const QUICK_ACTIONS = {
  patient: [
    { to: '/documents', title: 'Medical Documents', desc: 'Upload records and review access requests.', cta: 'Manage records' },
    { to: '/patient/appointments', title: 'Appointments', desc: 'Book, view, cancel, or reschedule visits.', cta: 'Open appointments' },
    { to: '/prescriptions', title: 'My Prescriptions', desc: 'View and download prescriptions issued to you.', cta: 'View prescriptions' },
  ],
  doctor: [
    { to: '/doctor/schedule', title: 'My Schedule', desc: 'Review appointments and record diagnoses.', cta: 'Open schedule' },
    { to: '/documents', title: 'Patient Documents', desc: 'Request and view released patient records.', cta: 'Review documents' },
    { to: '/prescriptions/new', title: 'Issue Prescription', desc: 'Prescribe medication for authorised patients.', cta: 'Issue now' },
    { to: '/doctor/prescriptions', title: 'Issued Prescriptions', desc: 'Track fulfilment and cancellation status.', cta: 'Track status' },
  ],
  pharmacist: [
    { to: '/pharmacy', title: 'Fulfilment Queue', desc: 'Dispense or reject pending prescriptions.', cta: 'Open queue' },
  ],
  admin: [
    { to: '/admin', title: 'Admin Console', desc: 'Review platform health and staff access.', cta: 'Open console' },
    { to: '/admin/doctors', title: 'Doctor Registrations', desc: 'Approve or reject pending doctor accounts.', cta: 'Review queue' },
    { to: '/admin/users', title: 'Manage Users', desc: 'Suspend, reactivate, or inspect user accounts.', cta: 'Manage users' },
    { to: '/admin/audit', title: 'Audit Logs', desc: 'Inspect security and document sharing events.', cta: 'Inspect logs' },
    { to: '/admin/announcements', title: 'Announcements', desc: 'Publish notices for all signed-in users.', cta: 'Manage posts' },
  ],
};

const DEFAULT_STATS = {
  documents: null,
  documentRequests: null,
  pendingDocumentRequests: null,
  appointments: null,
  prescriptions: null,
  pendingPrescriptions: null,
  activeSessions: null,
  flaggedEvents: null,
  pendingDoctors: null,
  totalUsers: null,
};

function formatDate(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function greetingName(user) {
  return user?.fullName || ROLE_LABEL[user?.role] || 'there';
}

function safeCount(value, fallback = '0') {
  return value === null || value === undefined ? fallback : value;
}

function StatCard({ label, value, hint, tone = 'default' }) {
  return (
    <div className={`hn-overview-stat hn-overview-stat-${tone}`}>
      <span>{label}</span>
      <strong>{safeCount(value, '-')}</strong>
      <p>{hint}</p>
    </div>
  );
}

function PriorityPanel({ user, stats, isPending }) {
  if (isPending) {
    return (
      <div className="hn-overview-priority hn-overview-priority-warning">
        <span>Approval required</span>
        <strong>Your account is pending admin approval.</strong>
        <p>Once approved, your role-specific tools will unlock automatically.</p>
      </div>
    );
  }

  const role = user.role;
  const messages = {
    patient: {
      label: 'Next best step',
      title: stats.pendingDocumentRequests > 0
        ? `${stats.pendingDocumentRequests} document request${stats.pendingDocumentRequests > 1 ? 's' : ''} need review`
        : 'Keep your care records up to date',
      copy: stats.pendingDocumentRequests > 0
        ? 'Review who is asking for access before approving or denying it.'
        : 'Upload useful records before appointments so doctors have the right context.',
      to: '/documents',
      cta: stats.pendingDocumentRequests > 0 ? 'Review requests' : 'Open documents',
    },
    doctor: {
      label: 'Clinical focus',
      title: stats.appointments > 0 ? `${stats.appointments} appointment${stats.appointments > 1 ? 's' : ''} on record` : 'Build your care workflow',
      copy: 'Use your schedule to review patients, then request only the documents needed for care.',
      to: '/doctor/schedule',
      cta: 'Open schedule',
    },
    pharmacist: {
      label: 'Queue status',
      title: stats.pendingPrescriptions > 0
        ? `${stats.pendingPrescriptions} prescription${stats.pendingPrescriptions > 1 ? 's' : ''} waiting`
        : 'No prescriptions waiting right now',
      copy: stats.pendingPrescriptions > 0
        ? 'Prioritise the fulfilment queue and record each dispensing decision.'
        : 'The dispensing queue is clear. New prescriptions will appear here when issued.',
      to: '/pharmacy',
      cta: 'Open queue',
    },
    admin: {
      label: 'Governance focus',
      title: stats.flaggedEvents > 0
        ? `${stats.flaggedEvents} flagged event${stats.flaggedEvents > 1 ? 's' : ''} in view`
        : 'Platform governance looks calm',
      copy: stats.pendingDoctors > 0
        ? `${stats.pendingDoctors} doctor registration${stats.pendingDoctors > 1 ? 's' : ''} still need review.`
        : 'Review audit logs regularly and keep staff access current.',
      to: stats.pendingDoctors > 0 ? '/admin/doctors' : '/admin/audit',
      cta: stats.pendingDoctors > 0 ? 'Review doctors' : 'Open audit logs',
    },
  };

  const item = messages[role] || messages.patient;

  return (
    <div className="hn-overview-priority">
      <span>{item.label}</span>
      <strong>{item.title}</strong>
      <p>{item.copy}</p>
      <Link to={item.to} className="hn-btn hn-btn-primary">{item.cta}</Link>
    </div>
  );
}

function buildTimeline(user, stats, announcements) {
  const items = [];
  if (announcements[0]) {
    items.push({
      label: 'Latest announcement',
      title: announcements[0].title,
      meta: formatDate(announcements[0].created_at),
    });
  }
  if (user.role === 'admin') {
    items.push({ label: 'Governance', title: `${safeCount(stats.totalUsers)} registered users`, meta: 'Account estate' });
    items.push({ label: 'Security', title: `${safeCount(stats.flaggedEvents)} flagged events`, meta: 'Audit visibility' });
  } else if (user.role === 'pharmacist') {
    items.push({ label: 'Dispensing', title: `${safeCount(stats.pendingPrescriptions)} waiting prescriptions`, meta: 'Fulfilment queue' });
  } else {
    items.push({ label: 'Records', title: `${safeCount(stats.documents)} available document${stats.documents === 1 ? '' : 's'}`, meta: 'Medical documents' });
    items.push({ label: 'Requests', title: `${safeCount(stats.documentRequests)} sharing request${stats.documentRequests === 1 ? '' : 's'}`, meta: 'Access control' });
  }
  return items.slice(0, 4);
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = ROLE_LABEL[user.role] ?? user.role;
  const roleIntro = ROLE_INTRO[user.role] ?? ROLE_INTRO.patient;
  const isPending = user.status === 'pending';
  const actions = isPending ? [] : (QUICK_ACTIONS[user.role] ?? []);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(DEFAULT_STATS);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      const nextStats = { ...DEFAULT_STATS };

      const safeLoad = async (fn) => {
        try {
          return await fn();
        } catch {
          return null;
        }
      };

      const announcementData = await safeLoad(() => apiGet('/admin/announcements'));
      if (active) setAnnouncements(announcementData || []);

      if (isPending) {
        if (active) setStats(nextStats);
        return;
      }

      if (user.role === 'admin') {
        const overview = await safeLoad(() => apiGet('/admin/overview'));
        Object.assign(nextStats, {
          activeSessions: overview?.activeSessions ?? null,
          flaggedEvents: overview?.flaggedEvents ?? null,
          pendingDoctors: overview?.pendingDoctors ?? null,
          totalUsers: overview?.totalUsers ?? null,
          pendingDocumentRequests: overview?.pendingDocumentRequests ?? null,
        });
      }

      if (user.role === 'patient') {
        const [documents, requests, appointments, prescriptions] = await Promise.all([
          safeLoad(() => apiGet('/documents')),
          safeLoad(() => apiGet('/documents/requests')),
          safeLoad(() => apiGet('/appointments/patient/history')),
          safeLoad(() => apiGet('/prescriptions/mine')),
        ]);
        nextStats.documents = documents?.items?.length ?? null;
        nextStats.documentRequests = requests?.items?.length ?? null;
        nextStats.pendingDocumentRequests = requests?.items?.filter((item) => item.status === 'pending').length ?? null;
        nextStats.appointments = appointments?.appointments?.length ?? null;
        nextStats.prescriptions = Array.isArray(prescriptions) ? prescriptions.length : null;
      }

      if (user.role === 'doctor') {
        const [requests, schedule, issued] = await Promise.all([
          safeLoad(() => apiGet('/documents/requests')),
          safeLoad(() => apiGet('/appointments/doctor/schedule')),
          safeLoad(() => apiGet('/prescriptions/issued')),
        ]);
        nextStats.documentRequests = requests?.items?.length ?? null;
        nextStats.documents = requests?.items?.filter((item) => item.status === 'approved').length ?? null;
        nextStats.appointments = schedule?.appointments?.length ?? null;
        nextStats.prescriptions = Array.isArray(issued) ? issued.length : null;
      }

      if (user.role === 'pharmacist') {
        const queue = await safeLoad(() => apiGet('/prescriptions/pharmacy'));
        nextStats.pendingPrescriptions = Array.isArray(queue) ? queue.length : null;
      }

      if (active) setStats(nextStats);
    }

    loadOverview();
    return () => {
      active = false;
    };
  }, [isPending, user.role]);

  const timeline = useMemo(
    () => buildTimeline(user, stats, announcements),
    [announcements, stats, user],
  );

  return (
    <div className="hn-page hn-overview-page">
      <section className="hn-overview-hero">
        <div>
          <span className="hn-badge">{roleIntro.eyebrow}</span>
          <h1>Welcome back, {greetingName(user)}</h1>
          <p>{roleIntro.subtitle}</p>
          <div className="hn-overview-hero-actions">
            {actions[0] ? <Link to={actions[0].to} className="hn-btn hn-btn-primary">{actions[0].cta}</Link> : null}
            <Link to="/profile" className="hn-btn hn-btn-outline">Review profile</Link>
          </div>
        </div>

        <aside className="hn-overview-spotlight">
          <span>{roleIntro.spotlight}</span>
          <strong>{role}</strong>
          <p>{isPending ? 'Pending approval' : 'Signed in and ready'}</p>
        </aside>
      </section>

      <section className="hn-overview-grid">
        <StatCard
          label={user.role === 'admin' ? 'Active sessions' : user.role === 'pharmacist' ? 'Waiting queue' : 'Documents'}
          value={user.role === 'admin' ? stats.activeSessions : user.role === 'pharmacist' ? stats.pendingPrescriptions : stats.documents}
          hint={user.role === 'admin' ? 'Current stored sessions' : user.role === 'pharmacist' ? 'Prescriptions awaiting action' : 'Records available to you'}
          tone="info"
        />
        <StatCard
          label={user.role === 'admin' ? 'Flagged events' : user.role === 'patient' ? 'Appointments' : user.role === 'doctor' ? 'Appointments' : 'Role'}
          value={user.role === 'admin' ? stats.flaggedEvents : user.role === 'pharmacist' ? 'Rx' : stats.appointments}
          hint={user.role === 'admin' ? 'Failed events tracked' : user.role === 'pharmacist' ? 'Prescription fulfilment workspace' : 'Appointments on record'}
          tone={stats.flaggedEvents > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={user.role === 'admin' ? 'Pending doctors' : user.role === 'pharmacist' ? 'Access scope' : 'Prescriptions'}
          value={user.role === 'admin' ? stats.pendingDoctors : user.role === 'pharmacist' ? 'Limited' : stats.prescriptions}
          hint={user.role === 'admin' ? 'Staff registrations to review' : user.role === 'pharmacist' ? 'Dispensing data only' : 'Prescription records'}
          tone="default"
        />
        <StatCard
          label={user.role === 'admin' ? 'Users' : user.role === 'pharmacist' ? 'Audit trail' : 'Sharing requests'}
          value={user.role === 'admin' ? stats.totalUsers : user.role === 'pharmacist' ? 'On' : stats.documentRequests}
          hint={user.role === 'admin' ? 'Registered accounts' : user.role === 'pharmacist' ? 'Fulfilment actions are logged' : 'Document access activity'}
          tone="success"
        />
      </section>

      <section className="hn-overview-main">
        <PriorityPanel user={user} stats={stats} isPending={isPending} />

        <div className="hn-card hn-overview-announcements">
          <div className="hn-overview-section-head">
            <div>
              <span className="hn-badge">Updates</span>
              <h2>Announcements</h2>
            </div>
            {user.role === 'admin' && !isPending ? (
              <Link to="/admin/announcements" className="hn-btn hn-btn-outline">Manage</Link>
            ) : null}
          </div>

          {announcements.length === 0 ? (
            <div className="hn-empty-state">No announcements yet. You are all caught up.</div>
          ) : (
            <div className="hn-overview-announcement-list">
              {announcements.slice(0, 3).map((a) => (
                <article key={a.id} className="hn-overview-announcement">
                  <strong>{a.title}</strong>
                  <p>{a.body}</p>
                  <span>{formatDate(a.created_at)}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {actions.length > 0 ? (
        <section className="hn-card hn-overview-actions-card">
          <div className="hn-overview-section-head">
            <div>
              <span className="hn-badge">Workspace</span>
              <h2>Quick actions</h2>
            </div>
            <p>Common tasks for your current role.</p>
          </div>

          <div className="hn-overview-action-grid">
            {actions.map((action) => (
              <Link key={action.to} to={action.to} className="hn-overview-action">
                <span>{action.title}</span>
                <p>{action.desc}</p>
                <strong>{action.cta}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="hn-card hn-overview-timeline-card">
        <div className="hn-overview-section-head">
          <div>
            <span className="hn-badge">Snapshot</span>
            <h2>What changed recently</h2>
          </div>
          <p>A lightweight summary based on your role and available records.</p>
        </div>

        <div className="hn-overview-timeline">
          {timeline.map((item) => (
            <div className="hn-overview-timeline-item" key={`${item.label}-${item.title}`}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.meta}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
