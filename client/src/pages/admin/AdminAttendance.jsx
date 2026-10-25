import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EventTypeIcon from '../../components/EventTypeIcon';
import { eventsApi } from '../../api/events';
import { Card, Badge, Button, EmptyState } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { EVENT_TYPE, ATTENDANCE_STATUS, formatDateTime } from '../../utils/format';

// Count attendance records by status for one event.
function tally(event) {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  (event.attendance || []).forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1;
  });
  counts.total = (event.attendance || []).length;
  return counts;
}

export default function AdminAttendance() {
  const { user } = useAuth();
  const readOnly = user?.role === 'CHAIRMAN'; // the chairman views attendance, the admin records it
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'admin'],
    queryFn: () => eventsApi.list({}),
  });
  const events = data?.events || [];

  return (
    <div>
      <PageHeader
        title="Attendance Records"
        description={
          readOnly
            ? 'Overview of attendance across all events. Open an event to see who attended.'
            : 'Overview of attendance across all events. Open an event to mark or edit attendees.'
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="Create an event in the Calendar first, then record attendance here."
            action={
              <Link to="/admin/calendar">
                <Button variant="accent">Go to Calendar</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {events.map((e) => {
              const t = EVENT_TYPE[e.type] || { label: e.type, tone: 'slate' };
              const c = tally(e);
              return (
                <Card key={e.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                          <EventTypeIcon type={e.type} size={18} className="text-brand-600" />
                          {e.title}
                        </h3>
                        <Badge tone={t.tone}>{t.label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{formatDateTime(e.startAt)}</p>
                    </div>
                    <Link to={`/admin/calendar/${e.id}`}>
                      <Button size="sm" variant="secondary">
                        {readOnly ? 'View' : 'Mark / View'}
                        <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>

                  {/* Per-status counts */}
                  <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-5">
                    {Object.entries(ATTENDANCE_STATUS).map(([key, v]) => (
                      <div key={key} className="bg-white p-3">
                        <dt className="text-sm font-semibold text-slate-600">{v.label}</dt>
                        <dd className="font-display text-3xl font-bold text-slate-900">
                          {c[key] || 0}
                        </dd>
                      </div>
                    ))}
                    <div className="bg-brand-50 p-3">
                      <dt className="text-sm font-semibold text-brand-800">Total</dt>
                      <dd className="font-display text-3xl font-bold text-brand-900">{c.total}</dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
