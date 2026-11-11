import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { attendanceApi } from '../api/attendance';
import { Button } from '../components/ui';
import AuthShell from '../components/AuthShell';
import { formatDateTime, formatTime } from '../utils/format';

// Opened by scanning a meeting's attendance QR code (no login). The SK official picks their
// name and submits; they are marked Present. Names already marked present leave the list,
// and outside the time the SK Admin set the page says "Attendance is closed."
export default function CheckIn() {
  const [params] = useSearchParams();
  const eventId = params.get('e');
  const token = params.get('t');
  const qc = useQueryClient();
  const [officialId, setOfficialId] = useState('');
  const [done, setDone] = useState(null); // { name, timeIn }
  const [problem, setProblem] = useState('');

  const key = ['attendance-page', eventId, token];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => attendanceApi.page(eventId, token),
    enabled: Boolean(eventId && token),
  });

  const submit = useMutation({
    mutationFn: () => attendanceApi.markPresent(eventId, token, officialId),
    onSuccess: (res) => {
      setDone({ name: res.record.participant, timeIn: res.record.timeIn });
      setOfficialId('');
      setProblem('');
      qc.setQueryData(key, (old) => (old ? { ...old, officials: res.officials } : old));
    },
    onError: (err) => {
      const body = err.response?.data || {};
      setProblem(body.message || 'Your attendance was not recorded. Try again.');
      if (body.code === 'CLOSED' || body.code === 'ALREADY') qc.invalidateQueries({ queryKey: key });
    },
  });

  const event = data?.event;
  let body;
  if (!eventId || !token) {
    body = <p className="text-slate-700">This attendance link is not complete. Scan the QR code again.</p>;
  } else if (isLoading) {
    body = <p className="text-slate-700">Loading…</p>;
  } else if (error || !data) {
    body = (
      <p className="text-slate-700">{error?.response?.data?.message || 'This meeting was not found. Scan the QR code again.'}</p>
    );
  } else if (!data.open) {
    body = (
      <div className="flex items-start gap-3 rounded-lg bg-slate-100 px-4 py-4 text-slate-800" role="status">
        <CircleAlert size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="font-semibold">{data.code === 'INVALID' ? data.message : 'Attendance is closed.'}</p>
      </div>
    );
  } else {
    const officials = data.officials || [];
    body = (
      <div className="space-y-4">
        {done && (
          <div className="flex items-start gap-3 rounded-lg bg-green-50 px-4 py-4 text-green-900" role="status">
            <CircleCheck size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">{done.name}</span> is marked Present at {formatTime(done.timeIn)}.
            </p>
          </div>
        )}
        {officials.length === 0 ? (
          <p className="text-slate-700">Every SK official is already marked present for this meeting.</p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!officialId) return setProblem('Choose your name from the list.');
              submit.mutate();
            }}
          >
            <label className="block">
              <span className="label">Your name</span>
              <select
                className="input"
                value={officialId}
                onChange={(e) => {
                  setOfficialId(e.target.value);
                  setProblem('');
                }}
                required
              >
                <option value="">Choose your name…</option>
                {officials.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.position ? ` (${o.position})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {problem && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {problem}
              </p>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <AuthShell title="Meeting attendance" description="Sangguniang Kabataan, Barangay Salinas 1">
      {event && (
        <div className="mb-5">
          <p className="text-lg font-bold text-slate-900">{event.title}</p>
          <p className="text-sm text-slate-600">
            {formatDateTime(event.startAt)}
            {event.location ? ` · ${event.location}` : ''}
          </p>
        </div>
      )}
      {body}
    </AuthShell>
  );
}
