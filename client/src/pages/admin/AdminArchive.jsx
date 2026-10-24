import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge, EmptyState } from '../../components/ui';
import { PROJECT_STATUS, formatPeso, formatDate } from '../../utils/format';
import { totalSpent } from '../../components/ProjectCard';

// Projects whose deletion the Barangay Chairman approved. Nothing is erased: the
// records, expenses, receipts and sessions stay here, read-only, and the chairman
// can restore a project if it was archived by mistake.
export default function AdminArchive() {
  const { user } = useAuth();
  const isChairman = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'archived'],
    queryFn: projectsApi.archived,
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

  return (
    <div>
      <PageHeader
        title="Archive"
        description="Deleted projects are kept here for the record. They are read-only and hidden from the public site and the Dashboard."
      />

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : projects.length === 0 ? (
          <EmptyState
            title="The archive is empty"
            description="A project appears here after the Barangay Chairman approves its deletion request."
          />
        ) : (
          <div className="space-y-4">
            {projects.map((p) => {
              const status = PROJECT_STATUS[p.status] || { label: p.status, tone: 'slate' };
              const request = p.deletionRequests?.[0];
              return (
                <Card key={p.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-900">{p.title}</p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Archived on {formatDate(p.archivedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={status.tone}>{status.label} when archived</Badge>
                      <Badge tone="slate">Archived</Badge>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">Reason:</span> {p.archivedReason || '—'}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {request?.requestedByName ? `Requested by ${request.requestedByName}` : ''}
                    {p.archivedByName ? ` · Approved by ${p.archivedByName}` : ''}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Budget</p>
                      <p className="font-medium text-slate-700">{formatPeso(p.budget)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Spent</p>
                      <p className="font-medium text-slate-700">{formatPeso(totalSpent(p))}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Progress at archive</p>
                      <p className="font-medium text-slate-700">{p.progress}%</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <Link to={`/admin/projects/${p.id}`}>
                      <Button size="sm" variant="secondary">
                        View records
                      </Button>
                    </Link>
                    {p.approvalState !== 'REJECTED' && p.status !== 'PROPOSED' && (
                      <Link to={`/admin/projects/${p.id}/report`}>
                        <Button size="sm" variant="secondary">
                          Report
                        </Button>
                      </Link>
                    )}
                    {isChairman && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={restoreMutation.isPending}
                        onClick={() => restore(p)}
                      >
                        Restore
                      </Button>
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
