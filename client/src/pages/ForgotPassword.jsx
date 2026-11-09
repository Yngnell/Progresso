import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button, Input } from '../components/ui';
import AuthShell from '../components/AuthShell';
import { accountApi } from '../api/account';

// Step 1 of a password reset: the person types their email and gets a one-time link.
// The answer is the same whether or not the email has an account.
export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await accountApi.forgotPassword(email.trim());
      setSent(res.message);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not send the link. Try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Forgot password" description="We will email you a link to choose a new password.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-green-50 px-4 py-4 text-green-900" role="status">
            <MailCheck size={26} strokeWidth={1.75} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
            <div>
              <p className="font-bold">{sent}</p>
              <p className="mt-1 text-[15px]">
                Open the email and click the link within 15 minutes. Check your Spam folder if it is not in your inbox.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => setSent('')}>
            Send to a different email
          </Button>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[15px] font-medium text-red-700" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Registered email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading || !email.trim()}>
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        </>
      )}
      <p className="mt-5 text-slate-600">
        Remembered it?{' '}
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/login">
          Back to Login
        </Link>
      </p>
    </AuthShell>
  );
}
