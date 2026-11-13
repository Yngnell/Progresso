import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { projectsApi } from '../api/projects';
import { Card } from '../components/ui';
import { ProgressMeter, StageSteps, StatusRibbon } from '../components/Roundel';
import PhotoGallery from '../components/PhotoGallery';
import { formatDate, formatPeso } from '../utils/format';

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold text-slate-900">{children || '—'}</dd>
    </div>
  );
}

export default function ProjectDetailPublic() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => projectsApi.get(id),
  });
  const project = data?.project;

  if (isLoading) return <p className="p-10 text-slate-600">Loading…</p>;
  if (isError || !project)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-700">Project not found.</p>
        <Link to="/projects" className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-700">
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Projects
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Projects
      </Link>

      <div className="mt-5">
        <div className="min-w-0">
          <StatusRibbon status={project.status} />
          <h1 className="mt-3 page-title">
            {project.title}
          </h1>
          {project.category && <p className="mt-1 text-slate-600">{project.category}</p>}
          <StageSteps status={project.status} className="mt-4 max-w-xl" />
        </div>
      </div>

      <Card className="mt-8 p-6">
        <p className="max-w-prose whitespace-pre-wrap text-[17px] leading-relaxed text-slate-700">
          {project.description || 'No description provided.'}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <Fact label="Budget">{formatPeso(project.estimatedCost ?? project.budget)}</Fact>
          <Fact label="Venue">{project.location}</Fact>
          <Fact label="Start">{formatDate(project.startDate)}</Fact>
          <Fact label="End">{formatDate(project.actualEndDate || project.endDate)}</Fact>
        </dl>
        {project.objectives && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-600">Objectives</p>
            <p className="mt-1 max-w-prose whitespace-pre-wrap text-slate-700">{project.objectives}</p>
          </div>
        )}
      </Card>

      {['ONGOING', 'COMPLETED'].includes(project.status) && (
        <Card className="mt-6 p-6">
          <h2 className="section-title">Progress</h2>
          <ProgressMeter value={project.progress} className="mt-4" label="How far along it is" />
          {(project.progressUpdates || []).length > 0 && (
            <ol className="mt-5 space-y-3">
              {project.progressUpdates.map((u) => (
                <li key={u.id} className="flex gap-3">
                  <span className="font-number w-12 shrink-0 text-right text-lg text-pine">{u.percent}%</span>
                  <div className="min-w-0 border-l-2 border-line pl-3">
                    <p className="font-semibold text-ink">{u.milestone}</p>
                    <p className="text-[13px] text-slate-600">{formatDate(u.date)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {project.status === 'COMPLETED' && project.accomplishmentSummary && (
            <p className="mt-5 max-w-prose whitespace-pre-wrap border-t border-slate-100 pt-4 text-slate-700">
              {project.accomplishmentSummary}
            </p>
          )}
        </Card>
      )}

      {project.photos?.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="section-title">Photos</h2>
          <div className="mt-4">
            <PhotoGallery photos={project.photos} />
          </div>
        </Card>
      )}

      {(project.officials || []).length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="section-title">
            Project team
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.officials.map((o) => (
              <li
                key={o.id}
                className="rounded-full bg-brand-50 px-3.5 py-1.5 text-[15px] font-semibold text-brand-800"
              >
                {o.name} <span className="font-normal text-brand-700">· {o.position}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
