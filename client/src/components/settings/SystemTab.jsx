import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Plus, RotateCcw, UserX, UserCheck } from 'lucide-react';
import { settingsApi } from '../../api/settings';
import { Badge, Button, Input, Modal } from '../ui';
import { Notice, Section, checkImage, errorText } from './shared';
import { useConfirm } from '../ConfirmDialog';

// Settings → System (SK Admin only): SK information and logo (printed on the PDF exports)
// and the SK officials list. The attendance QR defaults are in Meetings.
export default function SystemTab() {
  const { data } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const settings = data?.settings;
  if (!settings) return <p className="text-sm text-slate-600">Loading…</p>;
  return (
    <div className="space-y-6">
      <SkInfoSection settings={settings} />
      <OfficialsSection />
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
  const [ask, askDialog] = useConfirm();

  async function chooseLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkImage(file);
    if (problem) return setMsg({ ok: false, text: problem });
    if (!(await ask('Are you sure you want to upload this logo? It replaces the logo on the PDF exports.'))) return;
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
    if (!(await ask('Are you sure you want to remove the uploaded logo and use the SK seal again?'))) return;
    setLogoBusy(true);
    try {
      qc.setQueryData(['settings'], await settingsApi.removeLogo());
      setMsg({ ok: true, text: 'Back to the SK seal.' });
    } catch (err) {
      setMsg({ ok: false, text: errorText(err, 'The logo could not be removed.') });
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
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg(null);
            if (!(await ask('Are you sure you want to save the SK information?'))) return;
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
      {askDialog}
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
  const [ask, askDialog] = useConfirm();

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
          <table className="table-notebook table-stack">
            <thead>
              <tr>
                <th className="px-5 py-2 font-semibold sm:px-3">Name</th>
                <th className="px-3 py-2 font-medium">Position</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {officials.map((o) => (
                <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50 text-slate-500'}>
                  <td data-label="Name" className="px-5 py-3 font-semibold text-slate-900 sm:px-3">{o.name}</td>
                  <td data-label="Position" className="px-3 py-3">{o.position}</td>
                  <td data-label="Status" className="px-3 py-3">
                    <Badge tone={o.isActive ? 'green' : 'slate'}>{o.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td data-label="Actions" className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(o)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={save.isPending}
                        onClick={async () => {
                          const q = o.isActive
                            ? `Are you sure you want to set ${o.name} as inactive?`
                            : `Are you sure you want to set ${o.name} as active again?`;
                          if (!(await ask(q))) return;
                          save.mutate({
                            id: o.id,
                            body: { isActive: !o.isActive },
                            okText: o.isActive ? `${o.name} is now inactive.` : `${o.name} is active again.`,
                          });
                        }}
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
        onSave={async (body) => {
          const q = editing?.id
            ? 'Are you sure you want to save the changes to this official?'
            : 'Are you sure you want to add this official?';
          if (!(await ask(q))) return;
          save.mutate({
            id: editing?.id,
            body,
            okText: editing?.id ? 'The official was updated.' : `${body.name} was added.`,
          });
        }}
      />
      {askDialog}
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
