import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { Card, EmptyState } from '../../components/ui';
import PageHeader from '../../components/PageHeader';
import { ProgressMeter, StatusRibbon } from '../../components/Roundel';
import { PROJECT_STATUS, formatDate, formatPeso2 } from '../../utils/format';

// The Barangay Chairman's Projects (view only): the requests and projects still in progress.
// Drafts stay with the SK Admin; closed projects are in Archives.
const TABS = ['PENDING', 'FOR_REVISION', 'APPROVED', 'ONGOING'];

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
      <PageHeader title="Projects" description="SK Project Requests and projects in progress. View only; decide on requests in Approvals." />

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
              <span className="tabular ml-1.5 font-normal opacity-80">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState title="No projects here" description="Project Requests appear here once the SK Admin submits them." />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {projects.map((p) => (
                <li key={p.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center">
                  <div className="min-w-0 flex-1">
                    <StatusRibbon status={p.status} />
                    <p className="mt-1.5 truncate font-display text-lg text-ink">{p.title}</p>
                    <p className="text-sm text-slate-600">
                      {p.startDate ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` : 'Dates not set'} · {formatPeso2(p.estimatedCost)}
                    </p>
                  </div>
                  {p.status === 'ONGOING' && <ProgressMeter value={p.progress} className="w-full md:w-56" />}
                  <Link
                    to={`/admin/projects/${p.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-pine hover:underline"
                  >
                    View details <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
