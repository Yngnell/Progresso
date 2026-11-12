import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';
import { Button } from './ui';
import { Notice, errorText } from './settings/shared';

// Meetings → Attendance settings (SK Admin): the defaults for new attendance QR codes,
// as one compact row. The time can still be changed for each meeting when its QR is made.
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

  if (!settings) return null;
  return (
    <section className="card px-4 py-3 sm:px-5" aria-labelledby="attendance-settings-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="attendance-settings-title" className="font-display text-lg text-ink">
          Attendance settings
        </h2>
        <p className="text-[13px] text-slate-600">Defaults for new attendance QR codes; each meeting can still change them.</p>
      </div>
      {msg && (
        <div className="mt-2">
          <Notice ok={msg.ok}>{msg.text}</Notice>
        </div>
      )}
      <form
        className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,15rem)_auto] sm:items-end sm:justify-start"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(null);
          save.mutate({
            qrDefaultBeforeMin: Number(before),
            qrDefaultLengthMin: length === '' ? null : Number(length),
          });
        }}
      >
        <label className="block">
          <span className="label">Opens before the start (min)</span>
          <input
            className="input"
            type="number"
            min={0}
            max={240}
            value={before}
            onChange={(e) => setBefore(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label">Stays valid for (min)</span>
          <input
            className="input"
            type="number"
            min={10}
            max={1440}
            placeholder="Until the meeting ends"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            aria-describedby="qr-length-hint"
          />
        </label>
        <Button type="submit" variant="primary" disabled={save.isPending || lengthTooShort}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      <p id="qr-length-hint" className={`mt-1.5 text-[13px] ${lengthTooShort ? 'font-medium text-clay-text' : 'text-slate-600'}`}>
        Default: opens 30 minutes before. Valid for at least 10 minutes; leave empty to keep it valid until the meeting ends.
      </p>
    </section>
  );
}
