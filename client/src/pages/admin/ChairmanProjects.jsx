import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { Card, EmptyState } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { StatusRibbon } from '../../components/Roundel';
import { PROJECT_STATUS, WORK_STAGES, formatDateTime } from '../../utils/format';

// The Barangay Chairman's Projects (view only): one row per approved project with its
// name, stage, schedule and how many of the stage's documents are complete. View details
// opens the project page (details, documents and stage history).
const TABS = [...WORK_STAGES, 'ON_HOLD'];

export default function ChairmanProjects() {
  const [tab, setTab] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'admin'],
    queryFn: () => projectsApi.list({}),
  });
  const all = (data?.projects || []).filter((p) => TABS.includes(p.status));
  const projects = tab ? all.filter((p) => p.status === tab) : all;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Approved SK projects and how far along they are. View only."
      />

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter projects by status">
        {[{ value: '', label: 'All' }, ...TABS.map((s) => ({ value: s, label: PROJECT_STATUS[s].label }))].map((opt) => {
          const active = tab === opt.value;
          const count = opt.value ? all.filter((p) => p.status === opt.value).length : all.length;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setTab(opt.value)}
              aria-pressed={active}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${
                active ? 'bg-pine text-white' : 'bg-panel text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {opt.label}
              <span className="ml-1.5 tabular font-normal opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects here" description="Projects appear here once a Project Request is approved." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ project }) {
  const total = project.docsTotal || 0;
  const done = project.docsChecked || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <li className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <StatusRibbon status={project.status} />
        <p className="mt-1.5 truncate font-display text-lg text-ink">{project.title}</p>
        <p className="text-sm text-slate-600">
          {project.startDate && project.endDate
            ? `${formatDateTime(project.startDate)} – ${formatDateTime(project.endDate)}`
            : 'Schedule not set yet'}
        </p>
      </div>

      {/* Documents of the current stage; the Approved stage has none, so the status says it all. */}
      {total > 0 && (
        <div className="w-full md:w-56">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-slate-700">Stage documents</span>
            <span className="text-slate-600">
              {done} of {total} complete
            </span>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${project.title}: documents of the current stage`}
          >
            <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <Link
        to={`/admin/projects/${project.id}`}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-pine hover:underline"
      >
        View details <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </li>
  );
}
