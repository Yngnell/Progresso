import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2, UserRound } from 'lucide-react';
import { accountApi } from '../../api/account';
import { Button, Input } from '../ui';
import PasswordInput from '../PasswordInput';
import VerifyCodeForm from '../VerifyCodeForm';
import { roleLabel } from '../../utils/roles';
import { Notice, Section, checkImage, errorText } from './shared';

// Settings → Profile: name, email, contact number and picture. The position is shown but
// only the SK Chairperson changes it (Settings → System → User Management).
export default function ProfileTab({ user, refreshUser }) {
  return (
    <div className="space-y-6">
      <PictureSection user={user} refreshUser={refreshUser} />
      <DetailsSection user={user} refreshUser={refreshUser} />
      <EmailSection user={user} refreshUser={refreshUser} />
    </div>
  );
}

function PictureSection({ user, refreshUser }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const url = accountApi.photoUrl(user);

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
      await refreshUser();
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
      await refreshUser();
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
              {url ? 'Change picture' : 'Upload picture'}
            </Button>
            {url && (
              <Button variant="ghost" onClick={remove} disabled={busy}>
                <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-sm text-slate-600">JPG, JPEG, PNG or WEBP, up to 5 MB.</p>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={choose}
          />
        </div>
      </div>
      {msg && <div className="mt-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
    </Section>
  );
}

function DetailsSection({ user, refreshUser }) {
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user?.name, user?.phone]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await accountApi.updateProfile({ name: name.trim(), phone: phone.trim() });
      await refreshUser();
      setMsg({ ok: true, text: 'Your profile was saved.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'Your profile could not be saved.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Personal details">
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Contact number"
          type="tel"
          autoComplete="tel"
          placeholder="0917 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div>
          <span className="label">Position</span>
          <p className="input cursor-not-allowed bg-slate-50 text-slate-700" aria-readonly="true">
            {roleLabel(user)}
          </p>
          <p className="mt-1 text-xs text-slate-600">Only the SK Chairperson can change positions.</p>
        </div>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function EmailSection({ user, refreshUser }) {
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
      setMsg({ ok: false, text: errorText(err, 'The email could not be changed.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Email" description={`You log in with ${user?.email}. Changing it needs your current password.`}>
      {msg && <div className="mb-3"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      {pending ? (
        <div className="max-w-md space-y-3">
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
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Input
            label="New email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Change email'}
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}
