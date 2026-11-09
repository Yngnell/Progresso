import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from '../components/ui';
import AuthShell from '../components/AuthShell';
import PasswordInput from '../components/PasswordInput';
import PasswordChecklist, { passwordOk } from '../components/PasswordChecklist';
import { accountApi } from '../api/account';

// Step 2 of a password reset, opened from the emailed link. The link works once and
// expires after 15 minutes; then the person asks for a new one.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [state, setState] = useState('checking'); // checking | ready | bad | done
  const [badMessage, setBadMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) {
      setBadMessage('This reset link is not complete. Open the link from the email again.');
      setState('bad');
      return;
    }
    accountApi
      .checkResetToken(token)
      .then(() => setState('ready'))
      .catch((err) => {
        setBadMessage(err.response?.data?.message || 'This reset link does not work.');
        setState('bad');
      });
  }, [token]);

  // After a successful reset, go to the Login page.
  useEffect(() => {
    if (state !== 'done') return undefined;
    const t = setTimeout(
      () => navigate('/login', { replace: true, state: { notice: 'Your password was reset. Log in with your new password.' } }),
      3000
    );
    return () => clearTimeout(t);
  }, [state, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await accountApi.resetPassword(token, password, confirm);
      setState('done');
    } catch (err) {
      const data = err.response?.data || {};
      if (data.code === 'EXPIRED' || data.code === 'INVALID') {
        setBadMessage(data.message);
        setState('bad');
      } else {
        setError(data.message || 'The password could not be changed. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  let body;
  if (state === 'checking') {
    body = <p className="text-slate-700">Checking your link…</p>;
  } else if (state === 'bad') {
    body = (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-4 text-red-800" role="alert">
          <CircleAlert size={26} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="font-bold">{badMessage}</p>
        </div>
        <Link to="/forgot-password">
          <Button variant="primary" size="lg">Request a new link</Button>
        </Link>
      </div>
    );
  } else if (state === 'done') {
    body = (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 px-4 py-4 text-green-900" role="status">
        <CircleCheck size={26} strokeWidth={1.75} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
        <div>
          <p className="font-bold">Your password was reset.</p>
          <p className="mt-1 text-[15px]">Taking you to the Login page…</p>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-[15px] font-medium text-red-700" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <PasswordInput
              label="New Password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordChecklist password={password} confirm={confirm} />
          </div>
          <PasswordInput
            label="Confirm Password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={saving || !passwordOk(password, confirm)}
          >
            {saving ? 'Saving…' : 'Reset password'}
          </Button>
        </form>
      </>
    );
  }

  return (
    <AuthShell title="Choose a new password" description="Use a password you have not used here before.">
      {body}
      <p className="mt-5 text-slate-600">
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/login">
          Back to Login
        </Link>
      </p>
    </AuthShell>
  );
}
