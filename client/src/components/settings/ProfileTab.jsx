import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { accountApi } from '../../api/account';
import { Button, Input } from '../ui';
import VerifyChangeModal from './VerifyChangeModal';
import { Notice, Section, checkImage, errorText } from './shared';

const ROLE_NAME = { ADMIN: 'SK Admin', CHAIRMAN: 'Barangay Chairman', OFFICIAL: 'SK Official', VIEWER: 'Resident' };
const PHONE_PATTERN = /^09\d{9}$/;

// Settings → Profile. Only the picture and the contact number can be changed here; the
// name, email, position and role are read-only.
export default function ProfileTab({ user, refreshUser }) {
  return (
    <div className="space-y-6">
      <PictureSection user={user} refreshUser={refreshUser} />
      <DetailsSection user={user} />
      <ContactSection user={user} refreshUser={refreshUser} />
    </div>
  );
}

// The picture saves as soon as it is uploaded (no code needed).
function PictureSection({ user, refreshUser }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const url = accountApi.photoUrl(user);
  const qc = useQueryClient();
  // The header follows the refreshed user; the Officials pages read the officials list.
  const refreshPictures = async () => {
    await refreshUser();
    qc.invalidateQueries({ queryKey: ['officials'] });
  };

  async function choose(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setMsg({ ok: false, text: problem });
    setBusy(true);
    setMsg(null);
    try {
      await accountApi.uploadPhoto(file);
      await refreshPictures();
      setMsg({ ok: true, text: 'Your profile picture was updated.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'The picture could not be uploaded.') });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setMsg(null);
    try {
      await accountApi.removePhoto();
      await refreshPictures();
      setMsg({ ok: true, text: 'Your profile picture was removed.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'The picture could not be removed.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Profile picture">
      <div className="flex flex-wrap items-center gap-5">
        {url ? (
          <img src={url} alt="" className="h-24 w-24 rounded-full border border-slate-200 object-cover" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <UserRound size={40} strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>
              <Camera size={18} strokeWidth={1.75} aria-hidden="true" />
              {busy ? 'Uploading…' : url ? 'Change picture' : 'Upload picture'}
            </Button>
            {url && (
              <Button variant="ghost" onClick={remove} disabled={busy}>
                <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-sm text-slate-600">JPG, JPEG, PNG or WEBP, up to 5 MB. Saves right after you upload it.</p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={choose} />
        </div>
      </div>
      {msg && <div className="mt-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
    </Section>
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
      description="These cannot be changed here. Ask the SK Chairperson if your name, email or position is wrong."
    >
      <dl className="grid gap-4 sm:grid-cols-2">
        <ReadOnly label="Full name" value={user?.name} />
        <ReadOnly label="Email" value={user?.email} />
        <ReadOnly label="Position" value={user?.position || user?.official?.position} />
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
