import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input } from '../components/ui';
import AuthShell from '../components/AuthShell';
import VerifyCodeForm from '../components/VerifyCodeForm';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    receiveUpdates: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(''); // set once the code was emailed

  const { register, verifyEmail, resendCode } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await register(form);
      if (result.needsVerification) setPendingEmail(result.email);
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthShell
        title="Check your email"
        description="Enter the code we sent to finish creating your account."
      >
        <VerifyCodeForm
          email={pendingEmail}
          onVerify={(code) => verifyEmail(pendingEmail, code)}
          onResend={() => resendCode(pendingEmail)}
          onDone={() => navigate('/')}
        />
        <p className="mt-5 text-slate-600">
          Wrong address?{' '}
          <button
            type="button"
            className="font-semibold text-brand-700 hover:text-brand-800"
            onClick={() => setPendingEmail('')}
          >
            Go back
          </button>
        </p>
      </AuthShell>
    );
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
        {/* Consent is a choice, so the box starts unticked */}
        <label className="flex cursor-pointer items-start justify-end gap-2.5 text-right text-[15px] text-slate-700">
          <span>I would like to receive news, events and project updates by email.</span>
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
            checked={form.receiveUpdates}
            onChange={(e) => setForm({ ...form, receiveUpdates: e.target.checked })}
          />
        </label>
        <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Sending your code…' : 'Register'}
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
