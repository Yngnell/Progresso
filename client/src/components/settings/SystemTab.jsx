import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Plus, RotateCcw, UserX, UserCheck } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { Badge, Button, Input, Modal } from '../ui';
import { useAuth } from '../../context/AuthContext';
import { Notice, Section, checkImage, errorText } from './shared';

// Settings → System (SK Admin only): SK information and logo (printed on the PDF exports),
// the SK officials list, and the attendance QR defaults.
export default function SystemTab() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const settings = data?.settings;
  if (!settings) return <p className="text-sm text-slate-600">Loading…</p>;
  return (
    <div className="space-y-6">
      <SkInfoSection settings={settings} />
      <OfficialsSection />
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

// The SK officials: the names in the meeting attendance dropdown and on the public
// Officials page. They have no login accounts. Officials are never deleted (their
// attendance stays); one who left is set inactive and leaves the dropdown.
function OfficialsSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'officials'], queryFn: settingsApi.officials });
  const officials = data?.officials || [];
  const [editing, setEditing] = useState(null); // {} to add, or the official to change
  const [msg, setMsg] = useState(null);

  const refresh = (text) => {
    qc.invalidateQueries({ queryKey: ['settings', 'officials'] });
    qc.invalidateQueries({ queryKey: ['officials'] });
    setMsg({ ok: true, text });
  };
  const save = useMutation({
    mutationFn: ({ id, body }) => (id ? settingsApi.updateOfficial(id, body) : settingsApi.createOfficial(body)),
    onSuccess: (_res, vars) => {
      refresh(vars.okText);
      setEditing(null);
    },
    onError: (err) => setMsg({ ok: false, text: errorText(err, 'The change could not be saved.') }),
  });

  return (
    <Section
      title="SK officials"
      description="The names shown in the meeting attendance dropdown and on the public Officials page. Inactive officials are left out of the dropdown; their attendance records stay."
      actions={
        <Button variant="accent" onClick={() => setEditing({})}>
          <Plus size={18} strokeWidth={2} aria-hidden="true" />
          Add official
        </Button>
      }
    >
      {msg && <div className="mb-4"><Notice ok={msg.ok}>{msg.text}</Notice></div>}
      {isLoading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <div className="-mx-5 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-5 py-2 font-semibold sm:px-3">Name</th>
                <th className="px-3 py-2 font-semibold">Position</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {officials.map((o) => (
                <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50 text-slate-500'}>
                  <td className="px-5 py-3 font-semibold text-slate-900 sm:px-3">{o.name}</td>
                  <td className="px-3 py-3">{o.position}</td>
                  <td className="px-3 py-3">
                    <Badge tone={o.isActive ? 'green' : 'slate'}>{o.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(o)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={save.isPending}
                        onClick={() =>
                          save.mutate({
                            id: o.id,
                            body: { isActive: !o.isActive },
                            okText: o.isActive ? `${o.name} is now inactive.` : `${o.name} is active again.`,
                          })
                        }
                      >
                        {o.isActive ? (
                          <UserX size={16} strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <UserCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                        )}
                        {o.isActive ? 'Set inactive' : 'Set active'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <OfficialModal
        official={editing}
        busy={save.isPending}
        onClose={() => setEditing(null)}
        onSave={(body) =>
          save.mutate({
            id: editing?.id,
            body,
            okText: editing?.id ? 'The official was updated.' : `${body.name} was added.`,
          })
        }
      />
    </Section>
  );
}

// Add an official, or change one's name and position.
function OfficialModal({ official, busy, onClose, onSave }) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  useEffect(() => {
    setName(official?.name || '');
    setPosition(official?.position || (official ? 'SK Kagawad' : ''));
  }, [official]);
  const adding = official && !official.id;
  return (
    <Modal
      open={Boolean(official)}
      onClose={onClose}
      title={adding ? 'Add official' : 'Edit official'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={busy || !name.trim() || !position.trim()}
            onClick={() => onSave({ name: name.trim(), position: position.trim() })}
          >
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <PositionField value={position} onChange={setPosition} />
      </div>
    </Modal>
  );
}

function AdminOfficialSection() {
  const qc = useQueryClient();
  const { refreshUser, user } = useAuth();
  const { data } = useQuery({ queryKey: ['settings', 'officials'], queryFn: settingsApi.officials });
  const officials = data?.officials || [];
  const admins = data?.admins || [];
  const [msg, setMsg] = useState(null);

  const save = useMutation({
    mutationFn: ({ id, officialId }) => settingsApi.setAdminOfficial(id, officialId),
    onSuccess: async (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['settings', 'officials'] });
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

function AttendanceSection({ settings }) {
  const [before, setBefore] = useState(String(settings.qrDefaultBeforeMin));
  const [length, setLength] = useState(settings.qrDefaultLengthMin ? String(settings.qrDefaultLengthMin) : '');
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
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate({
            qrDefaultBeforeMin: Number(before),
            qrDefaultLengthMin: length === '' ? null : Number(length),
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
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" disabled={save.isPending || lengthTooShort}>
            {save.isPending ? 'Saving…' : 'Save attendance settings'}
          </Button>
        </div>
      </form>
    </Section>
  );
}
