import { Routes, Route, Link } from 'react-router-dom';

/**
 * App shell + routing skeleton. Role-based views (patient/doctor/pharmacist/
 * admin) plug in here as workstreams land. NOTE: any role checks in the UI are
 * for navigation/UX only — the real access control is server-side (D1 §9.2).
 */
function Home() {
  return (
    <div className="container py-5">
      <h1 className="mb-3">HealthNexus</h1>
      <p className="text-muted">Secure telemedicine &amp; EHR — skeleton frontend.</p>
      <nav className="d-flex gap-3">
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </nav>
    </div>
  );
}

function Placeholder({ title }) {
  return (
    <div className="container py-5">
      <h2>{title}</h2>
      <p className="text-muted">TODO: implement in the relevant workstream.</p>
      <Link to="/">← Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Placeholder title="Login" />} />
      <Route path="/register" element={<Placeholder title="Register" />} />
      <Route path="*" element={<Placeholder title="Not found" />} />
    </Routes>
  );
}
