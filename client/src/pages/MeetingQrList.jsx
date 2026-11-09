import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api/events';
import DateTile from '../components/DateTile';
import EventTypeIcon from '../components/EventTypeIcon';
import { AttendanceQrButton } from '../components/AttendanceQr';
import { Card } from '../components/ui';
import { EVENT_TYPE, formatDateTime } from '../utils/format';

const THREE_HOURS = 3 * 60 * 60 * 1000;

// The SK Chairperson's list of events that have not ended yet, each with its QR code.
export default function MeetingQrList() {
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'qr-list'],
    queryFn: () => eventsApi.list({}),
  });

  const now = Date.now();
  const events = (data?.events || [])
    .filter((e) => {
      const end = e.endAt ? new Date(e.endAt).getTime() : new Date(e.startAt).getTime() + THREE_HOURS;
      return end >= now;
    })
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-slate-900">Attendance QR</h1>
      <p className="mt-1 text-slate-600">
        Each event has its own QR code. Show it on a laptop or projector, or print it; officials scan it with their phone
        to record their attendance.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <Card className="p-6 text-slate-600">No upcoming events on the calendar.</Card>
        ) : (
          events.map((e) => (
            <Card key={e.id} className="flex flex-wrap items-center gap-4 p-4">
              <DateTile date={e.startAt} className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <EventTypeIcon type={e.type} size={16} className="text-brand-600" />
                  {e.title}
                </p>
                <p className="text-sm text-slate-600">
                  {EVENT_TYPE[e.type]?.label || e.type} · {formatDateTime(e.startAt)}
                </p>
              </div>
              <AttendanceQrButton event={e} />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
