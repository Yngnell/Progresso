import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CircleCheck, CircleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { attendanceApi } from '../api/attendance';
import { Button } from '../components/ui';
import AuthShell from '../components/AuthShell';
import { ATTENDANCE_STATUS, formatDateTime, formatTime } from '../utils/format';
import { isStaff } from '../utils/roles';

// Why a scan did not record attendance, in plain words.
function failureText(result) {
  switch (result.code) {
    case 'ALREADY':
      return result.record?.timeIn
        ? `Already recorded: your attendance for this event was recorded at ${formatTime(result.record.timeIn)}.`
        : 'Already recorded: your attendance for this event is already on file.';
    case 'EXPIRED':
      return 'Expired: this QR code is no longer valid. Ask the SK Chairperson for the current one.';
    case 'DEACTIVATED':
      return 'Deactivated: the SK Chairperson turned this QR code off.';
    case 'INVALID':
      return 'Not valid: this QR code was replaced with a new one. Scan the code shown at the event.';
    case 'NOT_OPEN':
      return result.opensAt
        ? `Not open yet: scanning opens at ${formatTime(result.opensAt)}.`
        : 'Not open yet: try again closer to the start of the event.';
    case 'NOT_FOUND':
      return 'This event was not found. Scan the QR code again.';
    default:
      return result.message || 'Your attendance was not recorded. Scan the QR code again.';
  }
}

// Opened by scanning an event's attendance QR code with the phone camera. Someone signed
// in is recorded straight away; anyone else logs in first and comes back here.
export default function CheckIn() {
  const [params] = useSearchParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  const eventId = params.get('e');
  const token = params.get('t');
  const [result, setResult] = useState(null); // { ok, record, event } or { ok: false, code, ... }
  const sent = useRef(false);

  useEffect(() => {
    if (loading || !user || !eventId || sent.current) return;
    sent.current = true;
    attendanceApi
      .checkIn(eventId, token)
      .then((res) => setResult({ ok: true, ...res }))
      .catch((err) => setResult({ ok: false, ...(err.response?.data || {}) }));
  }, [loading, user, eventId, token]);

  const back = { from: { pathname: location.pathname, search: location.search } };

  let body;
  if (!eventId || !token) {
    body = <p className="text-slate-700">This attendance link is not complete. Scan the QR code again.</p>;
  } else if (loading || (user && !result)) {
    body = <p className="text-slate-700">Recording your attendance…</p>;
  } else if (!user) {
    body = (
      <div className="space-y-4">
        <p className="text-slate-700">Log in first to record your attendance. You will come back here right after.</p>
        <Link to="/login" state={back}>
          <Button variant="primary" size="lg">Log in</Button>
        </Link>
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
            Attendance recorded for {result.event.title} at {formatTime(r.timeIn)}
          </p>
          <p className="mt-1">
            Status: <strong>{label}</strong> · {r.participant}
          </p>
          <p className="mt-1 text-sm">
            {formatDateTime(result.event.startAt)}
            {result.event.location ? ` · ${result.event.location}` : ''}
          </p>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-4 text-red-800" role="alert">
        <CircleAlert size={28} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold">{failureText(result)}</p>
          {result.event && (
            <p className="mt-1">
              {result.event.title} · {formatDateTime(result.event.startAt)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AuthShell title="Attendance" description="Sangguniang Kabataan, Barangay Salinas 1">
      {body}
      <p className="mt-6 text-slate-600">
        <Link className="font-semibold text-brand-700 hover:text-brand-800" to={isStaff(user) ? '/admin' : '/'}>
          {isStaff(user) ? 'Go to the dashboard' : 'Go to the website'}
        </Link>
      </p>
    </AuthShell>
  );
}
