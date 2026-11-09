import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { accountApi } from '../../api/account';
import { Button } from '../ui';
import PasswordInput from '../PasswordInput';
import PasswordChecklist, { passwordOk } from '../PasswordChecklist';
import { formatDateTime } from '../../utils/format';
import { Notice, Section, errorText } from './shared';

// Settings → Security: change the password (same rules and show/hide toggle as the Login
// page) and see when the account last logged in.
export default function SecurityTab({ user }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await accountApi.changePassword(current, next, confirm);
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ ok: true, text: 'Your password was changed.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'The password could not be changed.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Last login">
        <p className="text-slate-800">
          {user?.lastLoginAt ? (
            <>
              Your last login before this one was on <strong>{formatDateTime(user.lastLoginAt)}</strong>.
            </>
          ) : (
            'This is the first login recorded for your account.'
          )}
        </p>
        <p className="mt-1 text-sm text-slate-600">If you do not remember that login, change your password now.</p>
      </Section>

      <Section title="Change password">
        {msg && (
          <div className="mb-4">
            <Notice ok={msg.ok}>
              {msg.ok && <CircleCheck size={16} strokeWidth={1.75} className="mr-1 inline align-[-3px]" aria-hidden="true" />}
              {msg.text}
            </Notice>
          </div>
        )}
        <form onSubmit={submit} className="max-w-md space-y-4">
          <PasswordInput
            label="Current Password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <div>
            <PasswordInput
              label="New Password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
            <PasswordChecklist password={next} confirm={confirm} />
          </div>
          <PasswordInput
            label="Confirm Password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={busy || !current || !passwordOk(next, confirm)}>
            {busy ? 'Saving…' : 'Change password'}
          </Button>
        </form>
      </Section>
    </div>
  );
}
