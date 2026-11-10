import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Plus, RotateCcw, UserX, UserCheck } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { officialsApi } from '../../api/officials';
import { Badge, Button, Input, Modal } from '../ui';
import PasswordInput from '../PasswordInput';
import PasswordChecklist, { passwordOk } from '../PasswordChecklist';
import { formatDateTime } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';
import { Notice, Section, checkImage, errorText } from './shared';

// Settings → System (SK Chairperson only): SK information and logo (printed on the PDF
// exports), the officials' accounts, and the attendance QR defaults.
export default function SystemTab({ user }) {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const settings = data?.settings;
  if (!settings) return <p className="text-sm text-slate-600">Loading…</p>;
  return (
    <div className="space-y-6">
      <SkInfoSection settings={settings} />
      <UsersSection me={user} />
      <AdminOfficialSection />
      <AttendanceSection settings={settings} />
    </div>
  );
}

function useSaveSettings(setMsg, okText) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.save,
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res);
      setMsg({ ok: true, text: okText });
    },
    onError: (err) => setMsg({ ok: false, text: errorText(err, 'The settings could not be saved.') }),
  });
}

function SkInfoSection({ settings }) {
  const qc = useQueryClient();
  const input = useRef(null);
  const [name, setName] = useState(settings.barangayName);
  const [term, setTerm] = useState(settings.skTerm);
  const [msg, setMsg] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const save = useSaveSettings(setMsg, 'SK information saved.');

  async function chooseLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setMsg({ ok: false, text: problem });
    setLogoBusy(true);
    try {
      qc.setQueryData(['settings'], await settingsApi.uploadLogo(file));
      setMsg({ ok: true, text: 'The logo was updated. The PDF exports now use it.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'The logo could not be uploaded.') });
    } finally {
      setLogoBusy(false);
    }
  }

  async function resetLogo() {
    setLogoBusy(true);
    try {
      qc.setQueryData(['settings'], await settingsApi.removeLogo());
      setMsg({ ok: true, text: 'Back to the SK seal.' });
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <Section title="SK information" description="Printed at the top of every PDF export.">
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-3">
          <img
            src={settingsApi.logoUrl(settings)}
            alt="SK logo"
            className="h-28 w-28 rounded-full border border-slate-200 bg-white object-cover"
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()} disabled={logoBusy}>
              <ImageUp size={16} strokeWidth={1.75} aria-hidden="true" />
              Upload logo
            </Button>
            {settings.hasLogo && (
              <Button size="sm" variant="ghost" onClick={resetLogo} disabled={logoBusy}>
                <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                Use SK seal
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={chooseLogo} />
        </div>
        <form
          className="grid content-start gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            save.mutate({ barangayName: name.trim(), skTerm: term.trim() });
          }}
        >
          <Input
            className="sm:col-span-2"
            label="Barangay name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input label="SK term" placeholder="2023-2026" value={term} onChange={(e) => setTerm(e.target.value)} required />
          <div className="flex items-end">
            <Button type="submit" variant="primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save SK information'}
            </Button>
          </div>
        </form>
      </div>
    </Section>
  );
}

const POSITIONS = ['SK Chairperson', 'SK Secretary', 'SK Treasurer', 'SK Kagawad'];

function UsersSection({ me }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'accounts'], queryFn: settingsApi.accounts });
  const accounts = data?.accounts || [];
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // account whose position is being changed
  const [msg, setMsg] = useState(null);

  const update = useMutation({
    mutationFn: ({ id, data: body }) => settingsApi.updateAccount(id, body),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'accounts'] });
      qc.invalidateQueries({ queryKey: ['officials'] });
      setMsg({ ok: true, text: vars.okText });
      setEditing(null);
    },
    onError: (err) => setMsg({ ok: false, text: errorText(err, 'The account could not be changed.') }),
  });

  return (
    <Section
      title="User management"
      description="Accounts of the SK officials. Deactivated accounts cannot log in; their records stay."
      actions={
        <Button variant="accent" onClick={() => setAdding(true)}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Add official account
        </Button>
      }
    >
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      {isLoading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-5 py-2 font-semibold sm:px-3">Name</th>
                <th className="px-3 py-2 font-semibold">Position</th>
                <th className="px-3 py-2 font-semibold">Last login</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => {
                const self = a.id === me?.id;
                return (
                  <tr key={a.id} className={a.isActive ? '' : 'bg-slate-50 text-slate-500'}>
                    <td className="px-5 py-3 sm:px-3">
                      <p className="font-semibold text-slate-900">{a.name}{self ? ' (you)' : ''}</p>
                      <p className="text-slate-600">{a.email}</p>
                    </td>
                    <td className="px-3 py-3">{a.official?.position || '—'}</td>
                    <td className="px-3 py-3 tabular">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : 'Never'}</td>
                    <td className="px-3 py-3">
                      <Badge tone={a.isActive ? 'green' : 'slate'}>{a.isActive ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" disabled={self} onClick={() => setEditing(a)}>
                          Edit position
                        </Button>
                        {a.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={self || update.isPending}
                            onClick={() => {
                              if (window.confirm(`Deactivate ${a.name}'s account? They will not be able to log in.`)) {
                                update.mutate({ id: a.id, data: { isActive: false }, okText: `${a.name}'s account was deactivated.` });
                              }
                            }}
                          >
                            <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={update.isPending}
                            onClick={() =>
                              update.mutate({ id: a.id, data: { isActive: true }, okText: `${a.name}'s account is active again.` })
                            }
                          >
                            <UserCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddAccountModal
        open={adding}
        onClose={() => setAdding(false)}
        onDone={(account) => {
          setAdding(false);
          setMsg({ ok: true, text: `${account.name}'s account was created. Give them their email and starting password.` });
          qc.invalidateQueries({ queryKey: ['settings', 'accounts'] });
          qc.invalidateQueries({ queryKey: ['officials'] });
        }}
      />
      <PositionModal
        account={editing}
        busy={update.isPending}
        onClose={() => setEditing(null)}
        onSave={(position) =>
          update.mutate({ id: editing.id, data: { position }, okText: `${editing.name} is now ${position}.` })
        }
      />
    </Section>
  );
}

// The SK Admin account is shared, so it has no official of its own. Choosing an official
// here makes the header show that official's name and position when the admin is logged in.
function AdminOfficialSection() {
  const qc = useQueryClient();
  const { refreshUser, user } = useAuth();
  const { data } = useQuery({ queryKey: ['settings', 'accounts'], queryFn: settingsApi.accounts });
  const { data: officialsData } = useQuery({ queryKey: ['officials', 'all'], queryFn: () => officialsApi.list() });
  const officials = officialsData?.officials || [];
  const admins = data?.admins || [];
  const [msg, setMsg] = useState(null);

  const save = useMutation({
    mutationFn: ({ id, officialId }) => settingsApi.setAdminOfficial(id, officialId),
    onSuccess: async (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'accounts'] });
      if (vars.id === user?.id) await refreshUser();
      setMsg({ ok: true, text: 'Saved. The header shows the new name and position when the SK Admin logs in.' });
    },
    onError: (err) => setMsg({ ok: false, text: errorText(err, 'The change could not be saved.') }),
  });

  if (!admins.length) return null;
  return (
    <Section
      title="SK Admin account"
      description="Choose the official who uses the SK Admin account. Their name and position are shown in the header instead of “SK Admin”."
    >
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      <div className="space-y-4">
        {admins.map((a) => (
          <label key={a.id} className="block max-w-md">
            <span className="mb-1 block text-sm font-semibold text-slate-700">{a.email}</span>
            <select
              className="input"
              value={a.actsAsOfficialId || ''}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ id: a.id, officialId: e.target.value || null })}
            >
              <option value="">No official (show “SK Admin”)</option>
              {officials.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {o.position}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </Section>
  );
}

function PositionField({ value, onChange }) {
  return (
    <div>
      <label className="label" htmlFor="position-field">Position</label>
      <input
        id="position-field"
        className="input"
        list="position-options"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. SK Kagawad"
        required
      />
      <datalist id="position-options">
        {POSITIONS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </div>
  );
}

function PositionModal({ account, busy, onClose, onSave }) {
  const [position, setPosition] = useState('');
  useEffect(() => setPosition(account?.official?.position || ''), [account]);
  return (
    <Modal
      open={Boolean(account)}
      onClose={onClose}
      title="Edit position"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy || !position.trim()} onClick={() => onSave(position.trim())}>
            {busy ? 'Saving…' : 'Save position'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-slate-700">{account?.name}</p>
      <PositionField value={position} onChange={setPosition} />
      <p className="mt-2 text-sm text-slate-600">
        The account with the position "SK Chairperson" marks projects as complete and manages the attendance QR and these settings.
      </p>
    </Modal>
  );
}

const EMPTY = { name: '', email: '', position: 'SK Kagawad', password: '' };

function AddAccountModal({ open, onClose, onDone }) {
  const [form, setForm] = useState(EMPTY);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: settingsApi.createAccount,
    onSuccess: (res) => {
      setForm(EMPTY);
      setConfirm('');
      onDone(res.account);
    },
    onError: (err) => setError(errorText(err, 'The account could not be created.')),
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const ready = form.name.trim() && form.email.trim() && form.position.trim() && passwordOk(form.password, confirm);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add official account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="accent"
            disabled={!ready || create.isPending}
            onClick={() => {
              setError('');
              create.mutate({ ...form, name: form.name.trim(), email: form.email.trim(), position: form.position.trim() });
            }}
          >
            {create.isPending ? 'Creating…' : 'Create account'}
          </Button>
        </>
      }
    >
      {error && <div className="mb-4"><Notice ok={false}>{error}</Notice></div>}
      <div className="space-y-4">
        <Input label="Full name" value={form.name} onChange={set('name')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <PositionField value={form.position} onChange={(v) => setForm({ ...form, position: v })} />
        <div>
          <PasswordInput label="Starting password" autoComplete="new-password" value={form.password} onChange={set('password')} required />
          <PasswordChecklist password={form.password} confirm={confirm} />
        </div>
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <p className="text-sm text-slate-600">The official can change this password in Settings → Security after logging in.</p>
      </div>
    </Modal>
  );
}

function AttendanceSection({ settings }) {
  const [before, setBefore] = useState(String(settings.qrDefaultBeforeMin));
  const [length, setLength] = useState(settings.qrDefaultLengthMin ? String(settings.qrDefaultLengthMin) : '');
  const [late, setLate] = useState(String(settings.lateAfterMin));
  const [msg, setMsg] = useState(null);
  const save = useSaveSettings(setMsg, 'Attendance settings saved. New QR codes use them.');
  const lengthTooShort = length !== '' && Number(length) < 10;

  return (
    <Section
      title="Attendance settings"
      description="Defaults for new attendance QR codes. You can still change the time for each event when you generate its QR."
    >
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate({
            qrDefaultBeforeMin: Number(before),
            qrDefaultLengthMin: length === '' ? null : Number(length),
            lateAfterMin: Number(late),
          });
        }}
      >
        <div>
          <Input
            label="QR opens before the start"
            type="number"
            min={0}
            max={240}
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-600">Minutes. Default: 30.</p>
        </div>
        <div>
          <Input
            label="QR stays valid for"
            type="number"
            min={10}
            max={1440}
            placeholder="Until the event ends"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
          <p className={`mt-1 text-xs ${lengthTooShort ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
            Minutes, at least 10. Leave empty to keep it valid until the event ends.
          </p>
        </div>
        <div>
          <Input
            label="Late after"
            type="number"
            min={0}
            max={240}
            value={late}
            onChange={(e) => setLate(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-600">Minutes after the start. Later scans are marked Late. Default: 15.</p>
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" variant="primary" disabled={save.isPending || lengthTooShort}>
            {save.isPending ? 'Saving…' : 'Save attendance settings'}
          </Button>
        </div>
      </form>
    </Section>
  );
}
