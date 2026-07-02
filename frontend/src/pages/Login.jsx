import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';

export default function Login() {
  return (
    <div className="auth-page">
      <Card title="Login" subtitle="Your sign-in experience will be implemented here." className="auth-card">
        <div className="d-grid gap-2">
          <Button>Login</Button>
          <Link to="/" className="btn btn-outline-secondary">Back home</Link>
        </div>
      </Card>
    </div>
  );
}
