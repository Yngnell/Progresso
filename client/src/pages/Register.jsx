import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input } from '../components/ui';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500 text-lg font-bold text-white">
            SK
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Join as a Viewer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register to follow your barangay's SK news and projects.
          </p>
        </div>

        <Card className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              value={form.name}
              onChange={update('name')}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={update('email')}
              required
            />
            <Input
              label="Phone (optional)"
              value={form.phone}
              onChange={update('phone')}
            />
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={update('password')}
              minLength={6}
              required
            />
            <Button
              type="submit"
              variant="accent"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Register'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link className="font-medium text-brand-600 hover:text-brand-700" to="/login">
              Login
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

