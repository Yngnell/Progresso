import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import { Button, Card, Badge, EmptyState } from '../../components/ui';
import { ProjectCard } from '../../components/ProjectCard';
import { PROJECT_STATUS, formatPeso, formatDate } from '../../utils/format';
import ExportMenu from '../../components/ExportMenu';
import { settingsApi } from '../../api/settings';
import { exportArchiveExcel, exportArchivePdf } from '../../utils/reportExport';
import { useConfirm } from '../../components/ConfirmDialog';

const TABS = [
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'onhold', label: 'On Hold' },
  { id: 'deleted', label: 'Deleted' },
];

const EMPTY = {
  completed: ['No completed projects yet', 'A project appears here after the SK Admin marks it as completed.'],
  cancelled: ['No cancelled projects', 'A Project Request appears here when the Barangay Chairman rejects it.'],
  onhold: ['No on hold projects', 'An On Hold project appears here after the SK Admin moves it to Archives.'],
  deleted: ['No deleted projects', 'A project appears here after the Barangay Chairman approves its deletion request.'],
};

// Archives: completed, cancelled, on hold and deleted projects. They are view only; nothing is
// erased, and the Barangay Chairman can restore a deleted project.
export default function AdminArchive() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'completed';
  const { user } = useAuth();
  const [notice, setNotice] = useState(null); // { ok, text } after an export

  // The records of the open tab (the same query the list below uses), for the export.
  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'archive', tab],
    queryFn: () => projectsApi.list({ archive: tab }),
  });
  const shown = data?.projects || [];

  async function onExport(kind) {
    setNotice(null);
    try {
      const { settings } = await settingsApi.get();
      const args = { tab, projects: shown, settings, user };
      if (kind === 'pdf') await exportArchivePdf(args);
      else await exportArchiveExcel(args);
      const name = TABS.find((t) => t.id === tab).label;
      setNotice({ ok: true, text: `${name} archives exported as ${kind === 'pdf' ? 'PDF' : 'Excel'}.` });
    } catch (err) {
      setNotice({ ok: false, text: 'The export could not be made. Try again.' });
      throw err;
    }
  }

  return (
    <div>
      <PageHeader
        title="Archives"
        description="Completed, cancelled, on hold and deleted projects. They are view only and their records are kept."
        actions={<ExportMenu onExport={onExport} disabled={isLoading} />}
      />
      {notice && (
        <p className={`notice mt-4 ${notice.ok ? 'notice-ok' : 'notice-error'}`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Archives">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setNotice(null);
                setParams({ tab: t.id }, { replace: true });
              }}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${
                active ? 'bg-pine text-white' : 'bg-panel text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
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

// Completed, Cancelled or archived On Hold projects, opened read only.
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

  const [ask, askDialog] = useConfirm();
  const [notice, setNotice] = useState(null); // { ok, text }
  const restoreMutation = useMutation({
    mutationFn: (project) => projectsApi.restore(project.id),
    onSuccess: (_res, project) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      setNotice({ ok: true, text: `"${project.title}" was restored. It is back in the Projects list.` });
    },
    onError: (err) => setNotice({ ok: false, text: err?.response?.data?.message || 'Could not restore the project' }),
  });

  // Asks first, in the same dialog the SK Admin's actions use.
  async function restore(project) {
    if (await ask(`Are you sure you want to restore "${project.title}"? It will return to the Projects list.`)) {
      restoreMutation.mutate(project);
    }
  }

  const noticeLine = notice && (
    <p className={`notice ${notice.ok ? 'notice-ok' : 'notice-error'}`} role={notice.ok ? 'status' : 'alert'}>
      {notice.text}
    </p>
  );
  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (projects.length === 0)
    return (
      <div className="space-y-4">
        {noticeLine}
        <EmptyState title={EMPTY.deleted[0]} description={EMPTY.deleted[1]} />
      </div>
    );
  return (
    <div className="space-y-4">
      {noticeLine}
      {askDialog}
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
              <p className="text-slate-600">Budget</p>
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
