import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CircleCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accountApi } from '../api/account';
import { Button, Card, Input } from '../components/ui';
import VerifyCodeForm from '../components/VerifyCodeForm';

const ROLE_LABEL = { ADMIN: 'SK Administrator', CHAIRMAN: 'Barangay Chairman', VIEWER: 'Resident' };

function Notice({ ok, children }) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm font-medium ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
      role={ok ? 'status' : 'alert'}
    >
      {children}
    </p>
  );
}

// My Account: anyone signed in sees who they are and can change their own email and password.
export default function Account() {
  const { user, refreshUser } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'CHAIRMAN';

  // Fresh copy of the account (includes a waiting email change and the official's position).
  useEffect(() => {
    refreshUser().catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        to={staff ? '/admin' : '/'}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
        {staff ? 'Back to the dashboard' : 'Back to the website'}
      </Link>
      <h1 className="mt-4 font-display text-4xl font-bold uppercase tracking-wide text-slate-900">My account</h1>

      <Card className="mt-6 p-6">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-slate-600">Name</dt>
            <dd className="font-semibold text-slate-900">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-600">Account</dt>
            <dd className="font-semibold text-slate-900">
              {user?.official?.position || ROLE_LABEL[user?.role] || user?.role}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-slate-600">Login email</dt>
            <dd className="truncate font-semibold text-slate-900">{user?.email}</dd>
          </div>
        </dl>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <EmailCard user={user} refreshUser={refreshUser} />
        <PasswordCard />
      </div>
    </div>
  );
}

function EmailCard({ user, refreshUser }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const pending = user?.pendingEmail;

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await accountApi.changeEmail(newEmail.trim(), password);
      setPassword('');
      setNewEmail('');
      await refreshUser();
      if (res.changed) setMsg({ ok: true, text: 'Your login email was changed.' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'The email could not be changed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Change email</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">You will use the new email to log in.</p>
      {msg && <div className="mb-3"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      {pending ? (
        <div className="space-y-3">
          <VerifyCodeForm
            email={pending}
            onVerify={async (code) => {
              await accountApi.confirmEmail(code);
              await refreshUser();
              setMsg({ ok: true, text: 'Your login email was changed.' });
            }}
            onResend={() => accountApi.resendEmailCode()}
          />
          <button
            type="button"
            className="text-sm font-semibold text-slate-600 hover:text-slate-800"
            onClick={async () => {
              await accountApi.cancelEmailChange();
              await refreshUser();
            }}
          >
            Cancel the email change
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <Input
            label="New email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <Input
            label="Your current password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Change email'}
          </Button>
        </form>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ ok: false, text: 'The two new passwords do not match.' });
      return;
    }
    setBusy(true);
    try {
      await accountApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ ok: true, text: 'Your password was changed.' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || 'The password could not be changed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Change password</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">At least 8 characters.</p>
      {msg && (
        <div className="mb-3">
          <Notice ok={msg.ok}>
            {msg.ok && <CircleCheck size={16} strokeWidth={1.75} className="mr-1 inline align-[-3px]" aria-hidden="true" />}
            {msg.text}
          </Notice>
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </Card>
  );
}
