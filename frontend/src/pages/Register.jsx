import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';

export default function Register() {
  return (
    <div className="auth-page">
      <Card title="Register" subtitle="Your registration experience will be implemented here." className="auth-card">
        <div className="d-grid gap-2">
          <Button>Register</Button>
          <Link to="/" className="btn btn-outline-secondary">Back home</Link>
        </div>
      </Card>
    </div>
  );
}
