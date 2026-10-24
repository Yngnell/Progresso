import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { eventsApi } from '../api/events';
import { Card, Badge, EmptyState } from '../components/ui';
import { EVENT_TYPE, formatDateTime, formatTime } from '../utils/format';
import PageHeader from '../components/PageHeader';
import DateTile from '../components/DateTile';
import EventTypeIcon from '../components/EventTypeIcon';

export default function EventsPublic() {
  const { data, isLoading } = useQuery({
    queryKey: ['events', 'public'],
    queryFn: () => eventsApi.list({}),
  });
  const events = data?.events || [];
  const upcoming = events.filter((e) => new Date(e.startAt) >= new Date());

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader
        title="Events & Appointments"
        description="Upcoming meetings, sessions, and activities from your Sangguniang Kabataan."
      />

      <div className="mt-8">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="No upcoming events"
            description="Check back soon for new activities and meetings."
          />
        ) : (
          <div className="space-y-4">
            {upcoming.map((e) => {
              const t = EVENT_TYPE[e.type] || { label: e.type };
              return (
                <Card key={e.id} className="flex items-start gap-4 p-5">
                  <DateTile date={e.startAt} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        <EventTypeIcon type={e.type} size={18} className="text-brand-600" />
                        {e.title}
                      </h3>
                      <Badge tone={t.tone}>{t.label}</Badge>
                    </div>
                    <p className="mt-1 text-slate-700">
                      {formatDateTime(e.startAt)}
                      {e.endAt ? ` – ${formatTime(e.endAt)}` : ''}
                    </p>
                    {e.location && (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin size={15} strokeWidth={1.75} aria-hidden="true" />
                        {e.location}
                      </p>
                    )}
                    {e.description && <p className="mt-2 text-slate-600">{e.description}</p>}
                    {e.organizer && (
                      <p className="mt-2 text-sm text-slate-600">Organizer: {e.organizer.name}</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
