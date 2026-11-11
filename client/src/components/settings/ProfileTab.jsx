import { useState } from 'react';
import { accountApi } from '../../api/account';
import { Button, Input } from '../ui';
import VerifyChangeModal from './VerifyChangeModal';
import { Notice, Section, errorText } from './shared';

const ROLE_NAME = { ADMIN: 'SK Admin', CHAIRMAN: 'Barangay Chairman', OFFICIAL: 'SK Official', VIEWER: 'Resident' };
const PHONE_PATTERN = /^09\d{9}$/;

// Settings → Profile. Only the contact number can be changed here; the name, email,
// position and role are read-only.
export default function ProfileTab({ user, refreshUser }) {
  return (
    <div className="space-y-6">
      <DetailsSection user={user} />
      <ContactSection user={user} refreshUser={refreshUser} />
    </div>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function DetailsSection({ user }) {
  return (
    <Section
      title="Account details"
      description="These cannot be changed here. Ask the SK Admin if your name, email or position is wrong."
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <ReadOnly label="Full name" value={user?.name} />
        <ReadOnly label="Email" value={user?.email} />
        <ReadOnly label="Position" value={user?.position} />
        <ReadOnly label="Role" value={ROLE_NAME[user?.role] || user?.role} />
      </dl>
    </Section>
  );
}

// A new contact number is saved only after the code sent to the account email is entered.
function ContactSection({ user, refreshUser }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [verifying, setVerifying] = useState(null); // { email } while the code dialog is open
  const clean = phone.replace(/[\s-]/g, '');
  const invalid = clean.length > 0 && !PHONE_PATTERN.test(clean);

  async function submit(e) {
    e.preventDefault();
    if (!PHONE_PATTERN.test(clean)) {
      setMsg({ ok: false, text: 'Enter an 11-digit mobile number that starts with 09, e.g. 09171234567.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await accountApi.requestPhoneChange(clean);
      setVerifying({ email: res.email });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'We could not send the code. Try again.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Contact number"
      description={`Current number: ${user?.phone || 'none yet'}. A code is sent to your email before a new number is saved.`}
    >
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      <form onSubmit={submit} className="flex flex-wrap items-start gap-3">
        <div className="w-full max-w-xs">
          <Input
            label="New contact number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09171234567"
            maxLength={13}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className={`mt-1 text-xs ${invalid ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
            11 digits, starting with 09.
          </p>
        </div>
        <Button type="submit" variant="primary" className="mt-6" disabled={busy || !PHONE_PATTERN.test(clean)}>
          {busy ? 'Sending code…' : 'Send code'}
        </Button>
      </form>
      <VerifyChangeModal
        open={Boolean(verifying)}
        email={verifying?.email}
        what="contact number"
        onClose={() => {
          setVerifying(null);
          setMsg({ ok: false, text: 'Your contact number was not changed.' });
        }}
        onDone={async (res) => {
          setVerifying(null);
          setPhone('');
          await refreshUser();
          setMsg({ ok: true, text: res.message || 'Your contact number was updated.' });
        }}
      />
    </Section>
  );
}
