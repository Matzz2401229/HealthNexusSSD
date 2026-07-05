import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

/**
 * App shell + routing. The Navbar renders on every page for consistent
 * branding. Role-based dashboards (patient/doctor/pharmacist/admin) plug in as
 * routes here as workstreams land — build them against the tokens in theme.css.
 * NOTE: any role checks in the UI are for navigation only; real access control
 * is enforced server-side (D1 §9.2).
 */
function NotFound() {
  return (
    <div className="hn-page">
      <span className="hn-badge">404</span>
      <h1 style={{ margin: '1rem 0 0.5rem' }}>Page not found</h1>
      <p className="hn-text-muted">That page doesn’t exist yet.</p>
      <Link to="/" className="hn-btn hn-btn-primary" style={{ marginTop: '0.5rem' }}>Back home</Link>
    </div>
  );
}

/* Simple placeholder for routes a workstream hasn't built yet. */
function Placeholder({ title }) {
  return (
    <div className="hn-page">
      <h1>{title}</h1>
      <p className="hn-text-muted">TODO: implement in the relevant workstream.</p>
      <Link to="/">← Home</Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<Placeholder title="Forgot password" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
