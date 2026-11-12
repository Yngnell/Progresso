import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Expand } from 'lucide-react';
import { attendanceApi, checkInLink } from '../../api/attendance';
import { qrStatus } from '../../components/AttendanceQr';
import { ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

// Full-screen attendance QR for one meeting, shown on a laptop or projector by the SK
// Admin. The list of who is marked present updates live.
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
    <div className="min-h-screen px-4 py-6 text-ink sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/admin/meetings/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-pine hover:underline"
        >
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to the event
        </Link>
        <button
          type="button"
          onClick={goFullScreen}
          className="btn btn-secondary px-3 text-sm"
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
        <div className="mx-auto mt-6 grid max-w-content items-start gap-8 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center">
            <div className={`rounded-card border border-line bg-panel p-5 ${status.key === 'open' ? '' : 'opacity-40'}`}>
              <QRCodeSVG value={checkInLink(id, qr.token)} size={380} level="M" marginSize={1} aria-label="Attendance QR code" />
            </div>
            <p className="mt-4 text-center text-lg text-slate-700">Scan with your phone camera to record your attendance.</p>
            {status.key === 'open' && (
              <p className="mt-1 text-center text-slate-700">
                Closes at {formatTime(qr.validUntil)} ·{' '}
                <span className="font-display text-2xl text-clay-text">{minutesLeft} min</span> left
              </p>
            )}
            {status.key !== 'open' && (
              <p className="notice notice-warn mt-3 max-w-sm text-center text-sm font-medium">
                {status.key === 'off'
                  ? 'This QR code is deactivated.'
                  : status.key === 'soon'
                    ? `Scanning opens at ${formatTime(qr.validFrom)}.`
                    : `This QR code expired at ${formatDateTime(qr.validUntil)}.`}
              </p>
            )}
          </div>

          <div>
            <h1 className="page-title !text-[40px]">Attendance: {event.title}</h1>
            <p className="mt-3 text-lg text-slate-700">
              {formatDateTime(event.startAt)}
              {event.location ? ` · ${event.location}` : ''}
            </p>

            <h2 className="section-title mt-8 !text-[26px]">Recorded: {records.length}</h2>
            {records.length === 0 ? (
              <p className="mt-3 text-slate-600">Nobody yet. Names appear here as officials mark themselves present.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {[...records].reverse().map((r) => (
                  <li key={r.id} className="card flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate font-medium">{r.participant}</span>
                    <span className="shrink-0 text-sm text-slate-600">
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
