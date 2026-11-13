import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { projectsApi } from '../../api/projects';
import { useAuth } from '../../context/AuthContext';
import OverflowMenu from '../../components/OverflowMenu';
import { Button, EmptyState } from '../../components/ui';
import { ACTIVE_STATUSES, EDITABLE_STATUSES, PROJECT_STATUS } from '../../utils/format';
import { ProjectCard } from '../../components/ProjectCard';
import PageHeader from '../../components/PageHeader';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import ChairmanProjects from './ChairmanProjects';

// Projects still in progress; rejected, completed and cancelled ones are in Archives.
const statusOptions = ACTIVE_STATUSES.map((value) => ({ value, label: PROJECT_STATUS[value].label }));

// What each status is waiting for, shown on the card.
const WAITING = {
  DRAFT: 'Draft: not submitted yet',
  PENDING: 'Awaiting the Barangay Chairman’s decision',
  FOR_REVISION: 'Returned for revision',
  APPROVED: 'Approved: ready to start',
};

// Projects: the Barangay Chairman gets the view-only list; the SK Admin manages them.
export default function AdminProjects() {
  const { user } = useAuth();
  return user?.role === 'CHAIRMAN' ? <ChairmanProjects /> : <ProjectManagement />;
}

// The SK Admin's projects: new Project Requests, drafts and the projects under way.
function ProjectManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(() =>
    statusOptions.some((o) => o.value === searchParams.get('status')) ? searchParams.get('status') : ''
  );
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ? { ok: true, text: location.state.notice } : null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'admin'],
    queryFn: () => projectsApi.list({}),
  });
  const allProjects = data?.projects || [];
  const projects = filter ? allProjects.filter((p) => p.status === filter) : allProjects;
  const newRequest = () => navigate('/admin/projects/new');

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Project Requests, from the draft to the Barangay Chairman’s approval, and the projects under way."
        actions={
          <Button variant="accent" onClick={newRequest}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            New Project Request
          </Button>
        }
      />

      {notice && (
        <p className={`notice mt-4 ${notice.ok ? 'notice-ok' : 'notice-error'}`} role={notice.ok ? 'status' : 'alert'}>
          {notice.text}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter projects by status">
        {[{ value: '', label: 'All' }, ...statusOptions].map((opt) => {
          const active = filter === opt.value;
          const count = opt.value ? allProjects.filter((p) => p.status === opt.value).length : allProjects.length;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setFilter(opt.value)}
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
          <EmptyState
            title={filter ? `No ${PROJECT_STATUS[filter].label.toLowerCase()} projects` : 'No projects yet'}
            description="A project starts as a Project Request, funded by an ABYIP item."
            action={
              <Button variant="accent" onClick={newRequest}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                New Project Request
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const deletionPending = p.deletionRequests?.[0]?.status === 'PENDING';
              const waiting = deletionPending ? 'Deletion requested: awaiting the Barangay Chairman' : WAITING[p.status] || null;
              const editable = EDITABLE_STATUSES.includes(p.status);
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  to={`/admin/projects/${p.id}`}
                  notice={waiting}
                  footer={
                    <div className="flex flex-wrap items-center gap-2">
                      {editable && (
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/projects/${p.id}/edit`)}>
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                          Edit
                        </Button>
                      )}
                      <OverflowMenu
                        className="ml-auto"
                        items={[
                          {
                            label: deletionPending ? 'Deletion pending' : 'Request deletion',
                            Icon: Trash2,
                            danger: true,
                            disabled: deletionPending,
                            onClick: () => setDeleteTarget(p),
                          },
                        ]}
                      />
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeletionRequestModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSent={(text) => setNotice({ ok: true, text })}
        />
      )}
    </div>
  );
}
