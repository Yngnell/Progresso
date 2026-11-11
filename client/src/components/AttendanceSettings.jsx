import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';
import { Button, Input } from './ui';
import { Notice, Section, errorText } from './settings/shared';

// Meetings → Attendance settings (SK Admin): the defaults for new attendance QR codes.
// The values are the same saved settings as before; the time can still be changed for
// each meeting when its QR is generated.
export default function AttendanceSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const settings = data?.settings;
  const [before, setBefore] = useState('');
  const [length, setLength] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!settings) return;
    setBefore(String(settings.qrDefaultBeforeMin));
    setLength(settings.qrDefaultLengthMin ? String(settings.qrDefaultLengthMin) : '');
  }, [settings]);

  const save = useMutation({
    mutationFn: settingsApi.save,
    onSuccess: (res) => {
      qc.setQueryData(['settings'], res);
      setMsg({ ok: true, text: 'Attendance settings saved. New QR codes use them.' });
    },
    onError: (err) => setMsg({ ok: false, text: errorText(err, 'The settings could not be saved.') }),
  });
  const lengthTooShort = length !== '' && Number(length) < 10;

  if (!settings) return <p className="text-sm text-slate-600">Loading…</p>;
  return (
    <Section
      title="Attendance settings"
      description="Defaults for new attendance QR codes. You can still change the time for each meeting when you generate its QR."
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
            placeholder="Until the meeting ends"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          />
          <p className={`mt-1 text-xs ${lengthTooShort ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
            Minutes, at least 10. Leave empty to keep it valid until the meeting ends.
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
