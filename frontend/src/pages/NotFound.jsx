import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card.jsx';

export default function NotFound() {
  return (
    <div className="auth-page">
      <Card title="Page not found" subtitle="The page you’re looking for doesn’t exist." className="auth-card">
        <Link to="/" className="btn btn-outline-secondary">Back home</Link>
      </Card>
    </div>
  );
}
