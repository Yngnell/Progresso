import { useEffect, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { accountApi } from '../../api/account';
import { Button, Input, Modal } from '../ui';
import { Notice, errorText } from './shared';

const CODE_SECONDS = 5 * 60;
const RESEND_SECONDS = 60;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Asks for the 6-digit code emailed to the account before a new contact number or
// password is saved. The code works for 5 minutes and 3 tries; "Resend Code" is available
// 60 seconds after each code.
//   open, email:  show the dialog; the address the code went to
//   what:         "contact number" | "password" (for the wording)
//   onDone(res):  the change was saved
export default function VerifyChangeModal({ open, email, what, onClose, onDone }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(CODE_SECONDS); // seconds until the code expires
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [dead, setDead] = useState(false); // expired or 3 wrong tries

  // A fresh code each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCode('');
    setMsg({ ok: true, text: `We sent a 6-digit code to ${email}.` });
    setLeft(CODE_SECONDS);
    setCooldown(RESEND_SECONDS);
    setDead(false);
  }, [open, email]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open && left === 0 && !dead) {
      setDead(true);
      setMsg({ ok: false, text: 'The code has expired. Press Resend Code to get a new one.' });
    }
  }, [left, open, dead]);

  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await accountApi.verifyChange(code);
      onDone(res);
    } catch (err) {
      const text = errorText(err, 'That code did not work. Try again.');
      setMsg({ ok: false, text });
      setCode('');
      if (/no longer works|expired|no code waiting/i.test(text)) setDead(true);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      await accountApi.resendChangeCode();
      setMsg({ ok: true, text: `A new code was sent to ${email}.` });
      setLeft(CODE_SECONDS);
      setCooldown(RESEND_SECONDS);
      setDead(false);
      setCode('');
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'We could not send a new code. Try again.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Enter the code">
      <form onSubmit={verify} className="space-y-4">
        <div className="flex items-start gap-3 text-slate-700">
          <MailCheck size={24} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
          <p>
            To save your new {what}, enter the 6-digit code sent to{' '}
            <span className="font-semibold text-slate-900">{email}</span>.
          </p>
        </div>
        {msg && <Notice ok={msg.ok}>{msg.text}</Notice>}
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ letterSpacing: '0.4em' }}
          disabled={dead}
          autoFocus
        />
        <p className={`text-sm ${left <= 60 ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
          {dead ? 'This code no longer works.' : `Code expires in ${mmss(left)} · 3 tries per code`}
        </p>
        <div className="flex flex-wrap items-center gap-3 pb-2">
          <Button type="submit" variant="primary" disabled={busy || dead || code.length !== 6}>
            {busy ? 'Checking…' : 'Verify and save'}
          </Button>
          <Button variant="secondary" onClick={resend} disabled={busy || cooldown > 0}>
            {cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Resend Code'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
