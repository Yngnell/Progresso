import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { ProjectCard } from '../components/ProjectCard';
import { EmptyState } from '../components/ui';
import PageHeader from '../components/PageHeader';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'ONGOING', label: 'Ongoing' },
  { key: 'PLANNING', label: 'Planning' },
  { key: 'COMPLETED', label: 'Completed' },
];

export default function ProjectsPublic() {
  const [filter, setFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'public'],
    queryFn: () => projectsApi.list({}),
  });
  const projects = data?.projects || [];
  const shown = filter ? projects.filter((p) => p.status === filter) : projects;
  const count = (key) => (key ? projects.filter((p) => p.status === key).length : projects.length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader
        title="SK Projects"
        description="Follow the progress of programs and projects run by your Sangguniang Kabataan."
      />

      {projects.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter projects by status">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-brand-900 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {f.label}
              <span className="ml-1.5 font-display text-base opacity-80">{count(f.key)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-8">
        {isLoading ? (
          <p className="text-slate-600">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Your SK hasn't published any projects yet. Check back soon!"
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title="No projects in this group"
            description="Choose another status above to see more projects."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                footer={
                  <Link
                    to={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 text-[15px] font-semibold text-brand-700 hover:text-brand-800"
                  >
                    View details <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
