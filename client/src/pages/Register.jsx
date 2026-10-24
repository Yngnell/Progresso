import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';
import AuthShell from '../components/AuthShell';

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
    <AuthShell
      title="Join as a Viewer"
      description="Register to follow your barangay's SK news and projects."
    >
      {error && (
        <div
          className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[15px] font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          autoComplete="name"
          value={form.name}
          onChange={update('name')}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={update('email')}
          required
        />
        <Input label="Phone (optional)" autoComplete="tel" value={form.phone} onChange={update('phone')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          minLength={6}
          required
        />
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-5 text-slate-600">
        Already have an account?{' '}
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/login">
          Login
        </Link>
      </p>
    </AuthShell>
  );
}
