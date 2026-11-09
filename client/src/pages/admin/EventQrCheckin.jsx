import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Expand } from 'lucide-react';
import { attendanceApi, checkInLink } from '../../api/attendance';
import { qrStatus } from '../../components/AttendanceQr';
import { ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

// Full-screen attendance QR for one event, shown on a laptop or projector by the SK
// Chairperson. The list of who checked in updates live.
export default function EventQrCheckin() {
  const { id } = useParams();
  const [now, setNow] = useState(Date.now());

  const { data, error } = useQuery({
    queryKey: ['attendance-qr', id],
    queryFn: () => attendanceApi.qr(id),
    refetchInterval: 30000, // picks up a deactivation or a new code from another screen
  });
  const { data: attData } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => attendanceApi.list(id),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const event = data?.event;
  const qr = data?.qr;
  const records = attData?.records || [];
  const status = qrStatus(qr, now);
  const minutesLeft = qr ? Math.max(0, Math.ceil((new Date(qr.validUntil).getTime() - now) / 60000)) : 0;

  function goFullScreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-brand-900 px-4 py-6 text-white sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/admin/calendar/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-200 hover:text-white"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to the event
        </Link>
        <button
          type="button"
          onClick={goFullScreen}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-100 hover:bg-white/10"
        >
          <Expand size={16} strokeWidth={1.75} aria-hidden="true" /> Fill the screen
        </button>
      </div>

      {error ? (
        <p className="mt-10 text-center text-lg">{error.response?.data?.message || 'The QR code could not be loaded.'}</p>
      ) : !data ? (
        <p className="mt-10 text-center text-lg">Preparing the QR code…</p>
      ) : !qr ? (
        <p className="mt-10 text-center text-lg">
          No QR code yet. Go back to the event and choose Generate Attendance QR.
        </p>
      ) : (
        <div className="mx-auto mt-6 grid max-w-6xl items-start gap-8 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center">
            <div className={`rounded-2xl bg-white p-5 shadow-cardHover ${status.key === 'open' ? '' : 'opacity-40'}`}>
              <QRCodeSVG value={checkInLink(id, qr.token)} size={380} level="M" marginSize={1} aria-label="Attendance QR code" />
            </div>
            <p className="mt-4 text-center text-lg text-brand-100">Scan with your phone camera to record your attendance.</p>
            {status.key === 'open' && (
              <p className="mt-1 text-center text-brand-100">
                Closes at {formatTime(qr.validUntil)} ·{' '}
                <span className="font-display text-2xl font-bold text-accent-400">{minutesLeft} min</span> left
              </p>
            )}
            {status.key !== 'open' && (
              <p className="mt-3 max-w-sm rounded-lg bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-ink">
                {status.key === 'off'
                  ? 'This QR code is deactivated.'
                  : status.key === 'soon'
                    ? `Scanning opens at ${formatTime(qr.validFrom)}.`
                    : `This QR code expired at ${formatDateTime(qr.validUntil)}.`}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Attendance for</p>
            <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-none tracking-wide text-white">
              {event.title}
            </h1>
            <p className="mt-2 text-lg text-brand-100">
              {formatDateTime(event.startAt)}
              {event.location ? ` · ${event.location}` : ''}
            </p>

            <h2 className="mt-8 font-display text-3xl font-bold uppercase tracking-wide text-white">
              Recorded: {records.length}
            </h2>
            {records.length === 0 ? (
              <p className="mt-3 text-brand-100">Nobody yet. Names appear here as officials scan.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...records].reverse().map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2">
                    <span className="truncate font-semibold">{r.participant}</span>
                    <span className="shrink-0 text-sm text-brand-100">
                      {ATTENDANCE_STATUS[r.status]?.label || r.status}
                      {r.timeIn ? ` · ${formatTime(r.timeIn)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
