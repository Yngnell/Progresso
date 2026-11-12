import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { eventsApi } from '../../api/events';
import { attendanceApi } from '../../api/attendance';
import { useAuth } from '../../context/AuthContext';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import { AttendanceQrButton } from '../../components/AttendanceQr';
import { Card, Badge } from '../../components/ui';
import { EVENT_TYPE, ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

// A meeting and its attendance. Attendance is recorded only through the SK Admin's QR code
// QR code (Present, with the time). Once the event is over, every official who did not
// scan is recorded as Absent automatically. Nobody records or changes it by hand.
export default function AdminEventDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const { data: eventData, isLoading, isError } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.get(id),
  });
  const { data: attData } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => attendanceApi.list(id),
    refetchInterval: 30 * 1000, // new scans show up while the QR is on screen
  });

  const event = eventData?.event;
  const records = attData?.records || [];

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (isError || !event)
    return (
      <div className="text-center">
        <p className="text-slate-600">Event not found.</p>
        <Link to="/admin/meetings" className="mt-2 inline-block text-brand-600">
          ← Back to Meetings
        </Link>
      </div>
    );

  const t = EVENT_TYPE[event.type] || { label: event.type };
  const counts = { PRESENT: 0, ABSENT: 0 };
  records.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });

  return (
    <div>
      <Link
        to="/admin/meetings"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Meetings
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <DateTile date={event.startAt} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <h1 className="page-title">
            {event.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-slate-700">
            <EventTypeIcon type={event.type} size={17} className="text-brand-600" />
            {t.label} · {formatDateTime(event.startAt)}
          </p>
        </div>
        {user?.role === 'ADMIN' && <AttendanceQrButton event={event} size="md" />}
      </div>

      {/* Summary: Present and Absent */}
      <dl className="mt-6 grid max-w-md grid-cols-2 gap-px overflow-hidden rounded-card border border-slate-200 bg-slate-200">
        {Object.entries(ATTENDANCE_STATUS).map(([key, v]) => (
          <div key={key} className="bg-panel p-4">
            <dt className="section-label">{v.label}</dt>
            <dd className="font-display text-4xl text-slate-900">{counts[key] || 0}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <Card className="p-5">
          <h2 className="section-title">
            Attendance ({records.length})
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Officials scan the SK Admin&apos;s QR code and choose their name to record their attendance. When the
            meeting ends, every official not marked present is marked Absent.
          </p>
          <div className="mt-4">
            {records.length === 0 ? (
              <p className="text-slate-600">
                No attendance yet. The SK Admin shows the attendance QR code at the meeting, and
                officials scan it and choose their name.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-notebook table-stack">
                  <thead>
                    <tr>
                      <th className="py-2">Participant</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Time Checked In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Participant" className="py-2 text-slate-700">{r.participant}</td>
                        <td data-label="Status" className="py-2">
                          <Badge tone={ATTENDANCE_STATUS[r.status]?.tone}>
                            {ATTENDANCE_STATUS[r.status]?.label || r.status}
                          </Badge>
                        </td>
                        <td data-label="Time checked in" className="py-2 text-slate-600">
                          {r.status === 'PRESENT' && r.timeIn ? formatTime(r.timeIn) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
