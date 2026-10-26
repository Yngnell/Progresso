import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft } from 'lucide-react';
import { attendanceApi } from '../../api/attendance';
import { ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

// Full-screen QR for a meeting, shown on a laptop or projector. The code changes every
// 30 seconds (a photo of it stops working), and the list of who checked in updates live.
export default function EventQrCheckin() {
  const { id } = useParams();
  const [now, setNow] = useState(Date.now());

  const { data, error, refetch } = useQuery({
    queryKey: ['attendance', id, 'qr'],
    queryFn: () => attendanceApi.qrCode(id),
    refetchOnWindowFocus: false,
  });
  const { data: attData } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => attendanceApi.list(id),
    refetchInterval: 5000,
  });

  // Fetch the next code just after the current one expires.
  useEffect(() => {
    if (!data) return undefined;
    const t = setTimeout(() => refetch(), Math.max(500, data.expiresInMs + 300));
    return () => clearTimeout(t);
  }, [data, refetch]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  useEffect(() => setFetchedAt(Date.now()), [data]);

  const event = data?.event;
  const records = attData?.records || [];
  const secondsLeft = data ? Math.max(0, Math.ceil((data.expiresInMs - (now - fetchedAt)) / 1000)) : 0;
  const link = data ? `${window.location.origin}/checkin?e=${id}&t=${data.code}` : '';
  const open = data && now >= new Date(data.opensAt).getTime() && now <= new Date(data.closesAt).getTime();

  return (
    <div className="min-h-screen bg-brand-900 px-4 py-6 text-white sm:px-8">
      <Link
        to={`/admin/calendar/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-200 hover:text-white"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to the event
      </Link>

      {error ? (
        <p className="mt-10 text-center text-lg">{error.response?.data?.message || 'The QR code could not be loaded.'}</p>
      ) : !data ? (
        <p className="mt-10 text-center text-lg">Preparing the QR code…</p>
      ) : (
        <div className="mx-auto mt-6 grid max-w-6xl items-start gap-8 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center">
            <div className="rounded-2xl bg-white p-5 shadow-cardHover">
              <QRCodeSVG value={link} size={360} level="M" marginSize={1} aria-label="Check-in QR code" />
            </div>
            <p className="mt-4 text-center text-brand-100">
              Scan with your phone camera to check in.
              <br />
              New code in <span className="font-display text-2xl font-bold text-accent-400">{secondsLeft}s</span>
            </p>
            {!open && (
              <p className="mt-3 max-w-sm rounded-lg bg-accent-500 px-3 py-2 text-center text-sm font-semibold text-ink">
                Check-in is open from {formatTime(data.opensAt)} until {formatDateTime(data.closesAt)}.
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-200">Check in to</p>
            <h1 className="mt-1 font-display text-5xl font-bold uppercase leading-none tracking-wide text-white">
              {event.title}
            </h1>
            <p className="mt-2 text-lg text-brand-100">
              {formatDateTime(event.startAt)}
              {event.location ? ` · ${event.location}` : ''}
            </p>

            <h2 className="mt-8 font-display text-3xl font-bold uppercase tracking-wide text-white">
              Checked in: {records.length}
            </h2>
            {records.length === 0 ? (
              <p className="mt-3 text-brand-100">Nobody yet. Names appear here as people scan.</p>
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
