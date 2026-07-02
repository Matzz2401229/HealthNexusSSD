import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Secure Digital Healthcare Platform</p>
          <h1>HealthNexus connects healthcare with security and confidence.</h1>
          <p className="lead-text">
            Built to provide a seamless, secure & trusted experience for every member of the healthcare journey.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="btn btn-primary">Login</Link>
            <Link to="/register" className="btn btn-outline-secondary">Register</Link>
          </div>
        </div>

        <Card className="landing-card illustration-card">
          <div className="illustration-badge">Care made simple</div>
          <div className="illustration-graphic" aria-hidden="true">
            <div className="floating-icon">✚</div>
            <div className="doctor-card">
              <div className="doctor-head" />
              <div className="doctor-body" />
            </div>
            <div className="heart-icon" />
            <div className="pulse-line" />
          </div>
        </Card>
      </div>
    </div>
  );
}
