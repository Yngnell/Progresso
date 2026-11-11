import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge, EmptyState } from '../../components/ui';
import { ProjectCard } from '../../components/ProjectCard';
import { PROJECT_STATUS, formatPeso, formatDate } from '../../utils/format';

const TABS = [
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'deleted', label: 'Deleted' },
];

const EMPTY = {
  completed: ['No completed projects yet', 'A project appears here after the SK Admin marks it as completed.'],
  cancelled: ['No cancelled projects', 'A Project Request appears here when the Barangay Chairman rejects it.'],
  deleted: ['No deleted projects', 'A project appears here after the Barangay Chairman approves its deletion request.'],
};

// Archives: completed, cancelled and deleted projects. They are view only; nothing is
// erased, and the Barangay Chairman can restore a deleted project.
export default function AdminArchive() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'completed';

  return (
    <div>
      <PageHeader
        title="Archives"
        description="Completed, cancelled and deleted projects. They are view only and their records are kept."
      />

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Archives">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams({ tab: t.id }, { replace: true })}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${
                active ? 'bg-brand-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6" role="tabpanel">
        {tab === 'deleted' ? <DeletedList /> : <ClosedList tab={tab} />}
      </div>
    </div>
  );
}

// Completed or Cancelled projects, opened read only.
function ClosedList({ tab }) {
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'archive', tab],
    queryFn: () => projectsApi.list({ archive: tab }),
  });
  const projects = data?.projects || [];
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (projects.length === 0) return <EmptyState title={EMPTY[tab][0]} description={EMPTY[tab][1]} />;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          to={`/admin/projects/${p.id}`}
          footer={
            <Link to={`/admin/projects/${p.id}`} className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              View project
            </Link>
          }
        />
      ))}
    </div>
  );
}

// Projects whose deletion the Barangay Chairman approved.
function DeletedList() {
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'archive', 'deleted'],
    queryFn: () => projectsApi.list({ archive: 'deleted' }),
  });
  const projects = data?.projects || [];

  const restoreMutation = useMutation({
    mutationFn: (id) => projectsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  function restore(project) {
    if (window.confirm(`Restore "${project.title}"? It will return to the Projects list.`)) {
      restoreMutation.mutate(project.id);
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (projects.length === 0) return <EmptyState title={EMPTY.deleted[0]} description={EMPTY.deleted[1]} />;
  return (
    <div className="space-y-4">
      {projects.map((p) => {
        const status = PROJECT_STATUS[p.status] || { label: p.status, tone: 'slate' };
        const request = p.deletionRequests?.[0];
        return (
          <Card key={p.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900">{p.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">Deleted on {formatDate(p.archivedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={status.tone}>{status.label} when deleted</Badge>
                <Badge tone="slate">Deleted</Badge>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-semibold">Reason:</span> {p.archivedReason || '—'}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {request?.requestedByName ? `Requested by ${request.requestedByName}` : ''}
              {p.archivedByName ? ` · Approved by ${p.archivedByName}` : ''}
            </p>

            <div className="mt-3 text-sm">
              <p className="text-slate-400">Budget</p>
              <p className="font-medium text-slate-700">{formatPeso(p.budget)}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              <Link to={`/admin/projects/${p.id}`}>
                <Button size="sm" variant="secondary">
                  View records
                </Button>
              </Link>
              {isChairman && (
                <Button size="sm" variant="primary" disabled={restoreMutation.isPending} onClick={() => restore(p)}>
                  Restore
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
