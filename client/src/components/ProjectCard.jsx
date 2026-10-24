import { Link } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { formatPeso, formatDateTime } from '../utils/format';
import { ScheduleWords, StatusRibbon } from './Roundel';

// A slim progress bar for dense lists and tables. value is 0-100 and computed by the
// server. Pass the project's progressBreakdown as `breakdown` to show the gold
// "expected by now" tick and how the project stands against its dates.
// showValue={false} hides the % label when the surrounding card already shows it.
export function ProgressBar({ value = 0, breakdown, className = '', showValue = true }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const schedule = breakdown?.schedule;
  const expected = breakdown?.expected;
  const color =
    pct >= 100 || schedule === 'COMPLETED'
      ? 'bg-green-600'
      : schedule === 'BEHIND'
          ? 'bg-accent-600'
          : 'bg-brand-500';
  const showMarker = expected != null && schedule && schedule !== 'COMPLETED';

  return (
    <div className={`w-full ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {schedule ? (
          <ScheduleWords breakdown={breakdown} />
        ) : (
          <span className="text-sm font-medium text-slate-500">Progress</span>
        )}
        {showValue && (
          <span className="font-display text-lg font-bold leading-none text-slate-900">{pct}%</span>
        )}
      </div>
      <div
        className="relative h-2.5 w-full rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
        {showMarker && (
          <div
            className="absolute -top-1 h-[18px] w-[5px] -translate-x-1/2 rounded-sm bg-accent-500 ring-1 ring-ink"
            style={{ left: `${expected}%` }}
            title={`Expected by now: ${expected}%`}
          />
        )}
      </div>
    </div>
  );
}

// "3/4 sessions held · expected 55% · checklist 1/4" style summary.
// Progress comes from sessions (linked events) or, without any, the timeline;
// the checklist is shown for information only.
export function progressSummary(breakdown) {
  if (!breakdown) return '';
  const parts = [];
  if (breakdown.eventsTotal > 0) {
    parts.push(`${breakdown.eventsDone}/${breakdown.eventsTotal} sessions held`);
  }
  if (breakdown.source === 'timeline') parts.push('based on start and end dates');
  if (breakdown.expected != null && breakdown.schedule && breakdown.schedule !== 'COMPLETED') {
    parts.push(`expected by now ${breakdown.expected}%`);
  }
  if (breakdown.tasksTotal > 0) {
    parts.push(`checklist ${breakdown.tasksDone}/${breakdown.tasksTotal}`);
  }
  return parts.join(' · ');
}

// Sum of a project's expense amounts.
export function totalSpent(project) {
  return (project?.expenses || []).reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );
}

// Card used in both admin list and public grid. The ribbon carries status, the big number
// is the official progress, and the bar shows how it stands against its dates.
// to:     makes the title block a link to the project.
// notice: one line saying what the project is waiting for (e.g. the chairman's approval).
// footer: the actions row or link.
export function ProjectCard({ project, footer, to, notice }) {
  const spent = totalSpent(project);

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <StatusRibbon status={project.status} />
        <h3
          className={`mt-2 text-lg font-bold leading-snug text-slate-900 ${
            to ? 'group-hover:text-brand-700' : ''
          }`}
        >
          {project.title}
        </h3>
        {project.category && <p className="text-sm text-slate-600">{project.category}</p>}
      </div>
      <p
        className="font-display text-5xl font-bold leading-none text-ink"
        aria-label={`${project.progress} percent`}
      >
        {project.progress}
        <span className="text-2xl font-semibold">%</span>
      </p>
    </div>
  );

  return (
    <article className="card flex flex-col transition-shadow duration-200 hover:shadow-cardHover">
      <div className="p-5">
        {to ? (
          <Link
            to={to}
            className="group -m-2 block rounded-xl p-2 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
            aria-label={`Open ${project.title}`}
          >
            {header}
          </Link>
        ) : (
          header
        )}

        <div className="mt-4">
          <ProgressBar
            value={project.progress}
            breakdown={project.progressBreakdown}
            showValue={false}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {project.startDate && project.endDate ? (
            <span className="text-sm text-slate-600">
              {formatDateTime(project.startDate)} – {formatDateTime(project.endDate)}
            </span>
          ) : (
            <span />
          )}
          {notice && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <Hourglass size={15} strokeWidth={1.75} aria-hidden="true" />
              {notice}
            </span>
          )}
        </div>
      </div>

      <p className="line-clamp-2 px-5 text-sm leading-relaxed text-slate-600">
        {project.description || 'No description provided.'}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 px-5 py-4">
        <div>
          <dt className="text-sm text-slate-600">Budget</dt>
          <dd className="font-display text-xl font-bold text-slate-900">
            {formatPeso(project.budget)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Spent</dt>
          <dd className="font-display text-xl font-bold text-slate-900">{formatPeso(spent)}</dd>
        </div>
      </dl>

      {footer && <div className="border-t border-slate-100 px-5 py-3">{footer}</div>}
    </article>
  );
}
