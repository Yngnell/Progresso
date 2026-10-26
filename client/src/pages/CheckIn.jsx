import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceApi } from '../api/attendance';
import { Button } from '../components/ui';
import AuthShell from '../components/AuthShell';
import { ATTENDANCE_STATUS, formatDateTime, formatTime } from '../utils/format';

// Opened by scanning a meeting's QR code. A signed-in person is checked in straight away;
// anyone else logs in (or registers) first and comes back here automatically.
export default function CheckIn() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const eventId = params.get('e');
  const code = params.get('t');
  const [result, setResult] = useState(null); // { ok, already, record, event, error }
  const sent = useRef(false);

  useEffect(() => {
    if (loading || !user || !eventId || sent.current) return;
    sent.current = true;
    attendanceApi
      .checkIn(eventId, code)
      .then((res) => setResult({ ok: true, ...res }))
      .catch((err) => setResult({ ok: false, ...(err.response?.data || {}) }));
  }, [loading, user, eventId, code]);

  const back = { from: { pathname: location.pathname, search: location.search } };

  let body;
  if (!eventId) {
    body = <p className="text-slate-700">This check-in link is not complete. Scan the QR code again.</p>;
  } else if (loading || (user && !result)) {
    body = <p className="text-slate-700">Checking you in…</p>;
  } else if (!user) {
    body = (
      <div className="space-y-4">
        <p className="text-slate-700">Log in to check in to this meeting. You will come back here right after.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/login" state={back}>
            <Button variant="primary" size="lg">Log in</Button>
          </Link>
          <Link to="/register" state={back}>
            <Button variant="secondary" size="lg">Register</Button>
          </Link>
        </div>
      </div>
    );
  } else if (result.ok) {
    const r = result.record;
    const label = ATTENDANCE_STATUS[r.status]?.label || r.status;
    body = (
      <div className="flex items-start gap-3 rounded-lg bg-green-50 px-4 py-4 text-green-900" role="status">
        <CircleCheck size={28} strokeWidth={1.75} className="mt-0.5 shrink-0 text-green-700" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold">
            {result.already ? `You're already checked in (${formatTime(r.timeIn)}).` : `You're marked ${label}.`}
          </p>
          <p className="mt-1">
            {result.event.title} · {formatDateTime(result.event.startAt)}
            {result.event.location ? ` · ${result.event.location}` : ''}
          </p>
          {!result.already && <p className="mt-1 text-sm">Checked in at {formatTime(r.timeIn)} as {r.participant}.</p>}
        </div>
      </div>
    );
  } else {
    const msg =
      result.code === 'NOT_OPEN' && result.opensAt
        ? `Check-in opens at ${formatTime(result.opensAt)}.`
        : result.message || 'Check-in did not work. Scan the code on the screen again.';
    body = (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-4 text-red-800" role="alert">
        <CircleAlert size={28} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold">{msg}</p>
          {result.event && <p className="mt-1">{result.event.title} · {formatDateTime(result.event.startAt)}</p>}
        </div>
      </div>
    );
  }

  return (
    <AuthShell title="Meeting check-in" description="Sangguniang Kabataan, Barangay Salinas 1">
      {body}
      <p className="mt-6 text-slate-600">
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to="/">
          Go to the website
        </Link>
      </p>
    </AuthShell>
  );
}
