import { Link } from 'react-router-dom';
import { CircleCheck, Clock, Users } from 'lucide-react';
import { ProgressBar, progressSummary } from './ProjectCard';
import { formatDateTime } from '../utils/format';

// Progress card: how the project's progress is measured (its project type) and the
// events linked to it. Read-only everywhere; progress is computed by the server.
//   Date and Time Based: the time passed between the start and the end.
//   Attendee Based: people who checked in at the linked events ÷ target attendees.
export default function ProjectProgress({ project, eventLink }) {
  const b = project.progressBreakdown || {};
  const attendeeBased = b.type === 'ATTENDEE';
  const events = project.events || [];
  const now = new Date();
  const summary = progressSummary(b);

  return (
    <div>
      <ProgressBar value={project.progress} breakdown={b} />
      {summary && <p className="mt-2 text-sm text-slate-600">{summary}</p>}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-sm font-semibold text-slate-600">Project type</dt>
          <dd className="font-semibold text-slate-900">{attendeeBased ? 'Attendee Based' : 'Date and Time Based'}</dd>
        </div>
        {attendeeBased ? (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <dt className="text-sm font-semibold text-slate-600">Attendees</dt>
            <dd className="flex items-center gap-2 font-semibold text-slate-900">
              <Users size={17} strokeWidth={1.75} className="text-brand-700" aria-hidden="true" />
              {b.attendees || 0} of {b.targetAttendees || 0} checked in
            </dd>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <dt className="text-sm font-semibold text-slate-600">Schedule</dt>
            <dd className="font-semibold text-slate-900">
              {project.startDate ? `${formatDateTime(project.startDate)} – ${formatDateTime(project.endDate)}` : '—'}
            </dd>
          </div>
        )}
      </dl>

      {/* Linked events */}
      <h3 className="mt-7 text-lg font-bold text-slate-900">Linked events</h3>
      <p className="text-sm text-slate-600">
        {attendeeBased
          ? 'Everyone who checks in (Present or Late) at these events counts toward the target attendees.'
          : 'Events scheduled for this project. Link one from the Calendar by choosing this project.'}
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-slate-600">No events linked yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {events.map((ev) => {
            const held = new Date(ev.endAt || ev.startAt) <= now;
            const title = eventLink ? (
              <Link to={eventLink(ev)} className="font-medium text-brand-700 hover:text-brand-800">
                {ev.title}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{ev.title}</span>
            );
            const count = ev._count?.attendance;
            return (
              <li key={ev.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                {held ? (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CircleCheck size={17} strokeWidth={1.75} aria-hidden="true" /> Held
                  </span>
                ) : (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Clock size={17} strokeWidth={1.75} aria-hidden="true" /> Upcoming
                  </span>
                )}
                <span className="min-w-0 flex-1">{title}</span>
                {attendeeBased && count != null && (
                  <span className="text-sm font-semibold text-slate-700">{count} checked in</span>
                )}
                <span className="hidden text-sm text-slate-600 sm:block">{formatDateTime(ev.startAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
