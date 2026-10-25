import { useEffect, useState } from 'react';
import { Button, Input } from './ui';

// Enter the 6-digit code that was emailed. Used by sign-up, login (unverified account) and
// the alert-email box in the notification bell.
//   onVerify(code): resolves when the code is right, throws an axios error otherwise.
//   onResend():     asks for a new code.
// compact: smaller layout for the bell dropdown.
export default function VerifyCodeForm({ email, onVerify, onResend, compact = false, onDone }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(60); // a code was just sent

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await onVerify(code.trim());
      onDone?.();
    } catch (err) {
      setError(err.response?.data?.message || 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError('');
    setInfo('');
    try {
      await onResend();
      setInfo('A new code is on its way.');
      setCooldown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not send a new code.');
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'space-y-2' : 'space-y-4'}>
      <p className={compact ? 'text-sm text-slate-700' : 'text-slate-700'}>
        We sent a 6-digit code to <span className="font-semibold text-slate-900">{email}</span>.
        It expires in 15 minutes.
      </p>
      {error && (
        <div
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}
      {info && <p className="text-sm font-medium text-green-700">{info}</p>}
      <Input
        label={compact ? undefined : 'Verification code'}
        aria-label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ letterSpacing: '0.4em' }}
        required
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="primary"
          size={compact ? 'sm' : 'lg'}
          disabled={busy || code.length !== 6}
        >
          {busy ? 'Checking…' : 'Verify'}
        </Button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="text-sm font-semibold text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </button>
      </div>
    </form>
  );
}
