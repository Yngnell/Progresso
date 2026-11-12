import { Link } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { formatPeso, formatDateTime } from '../utils/format';
import { StageSteps, StatusRibbon } from './Roundel';

// Card used in both the admin lists and the public grid. The ribbon is the status badge
// and the steps show where the project is in the flow.
// to:     makes the title block a link to the project.
// notice: one line saying what the project is waiting for (e.g. the chairman's approval).
// footer: the actions row or link.
export function ProjectCard({ project, footer, to, notice }) {
  const header = (
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
  );

  return (
    <article className="card flex flex-col transition-shadow duration-200 hover:shadow-cardHover">
      <div className="p-5">
        {to ? (
          <Link
            to={to}
            className="group -m-2 block rounded-card p-2 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
            aria-label={`Open ${project.title}`}
          >
            {header}
          </Link>
        ) : (
          header
        )}

        <StageSteps status={project.status} heldFrom={project.heldFromStatus} className="mt-4" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
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

      <dl className="mt-4 border-t border-slate-100 px-5 py-4">
        <div>
          <dt className="text-sm text-slate-600">Budget</dt>
          <dd className="font-display text-xl text-slate-900">
            {formatPeso(project.budget)}
          </dd>
        </div>
      </dl>

      {footer && <div className="border-t border-slate-100 px-5 py-3">{footer}</div>}
    </article>
  );
}
