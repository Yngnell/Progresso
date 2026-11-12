import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { officialsApi } from '../../api/officials';
import { useAuth } from '../../context/AuthContext';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import OverflowMenu from '../../components/OverflowMenu';
import { Button, Modal, EmptyState } from '../../components/ui';
import { PROJECT_STATUS, toDateTimeLocal } from '../../utils/format';
import { ProjectCard } from '../../components/ProjectCard';

import PageHeader from '../../components/PageHeader';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import ProjectProposalForm, { emptyItem, prDateOk } from '../../components/ProjectProposalForm';
import ChairmanProjects from './ChairmanProjects';

// Active stages only: Completed and Cancelled projects are in Archives.
const statusOptions = ['PROPOSED', 'PLANNING', 'ONGOING', 'ON_HOLD'].map((value) => ({
  value,
  label: PROJECT_STATUS[value].label,
}));

// A fresh form: one empty purchase request row, to which the + button adds more.
const blankForm = () => ({
  purpose: '', // first line = project name, the rest = description
  items: [{ ...emptyItem }],
});

// Projects: the Barangay Chairman gets the simple view-only list; the SK Admin manages them.
export default function AdminProjects() {
  const { user } = useAuth();
  return user?.role === 'CHAIRMAN' ? <ChairmanProjects /> : <ProjectManagement />;
}

// The SK Admin's Project Management (Project Request, edit, deletion requests).
function ProjectManagement() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  // ?status=PROPOSED (e.g. from the Dashboard) opens the list on that stage.
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState(() =>
    statusOptions.some((o) => o.value === searchParams.get('status')) ? searchParams.get('status') : ''
  );
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', 'admin'],
    queryFn: () => projectsApi.list({}),
  });
  const { data: officialsData } = useQuery({
    queryKey: ['officials', 'active'],
    queryFn: () => officialsApi.list({ active: 'true' }),
  });
  const officials = officialsData?.officials || [];
  const allProjects = data?.projects || [];
  const projects = filter
    ? allProjects.filter((p) => p.status === filter)
    : allProjects;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['projects'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing ? projectsApi.update(editing.id, payload) : projectsApi.create(payload),
    onSuccess: () => {
      invalidate();
      closeModal();
    },
    onError: (err) =>
      setError(err.response?.data?.message || 'Failed to save project'),
  });

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setError('');
    setModalOpen(true);
  }

  function openEdit(project) {
    setEditing(project);
    const rows = (project.requestItems || []).map((r) => ({
      prNo: r.prNo || '',
      prDate: r.prDate ? toDateTimeLocal(r.prDate).slice(0, 10) : '',
      // The saved date stays allowed even if it is now in the past.
      savedDate: r.prDate ? toDateTimeLocal(r.prDate).slice(0, 10) : '',
      requestedBy: r.requestedBy || '',
      amount: r.amount != null ? String(r.amount) : '',
    }));
    setForm({
      // Name on the first line and the description below it, so saving keeps both.
      purpose: project.description ? `${project.title}\n${project.description}` : project.title || '',
      items: rows.length > 0 ? rows : [{ ...emptyItem }],
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(blankForm());
    setError('');
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function updateItem(index, field, value) {
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  }

  // Inserts an empty row right below the one whose + was pressed.
  function addItem(index) {
    setForm((f) => ({
      ...f,
      items: [...f.items.slice(0, index + 1), { ...emptyItem }, ...f.items.slice(index + 1)],
    }));
  }

  function removeItem(index) {
    setForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // The purpose of request is the project: first line = name, the rest = description.
    const [firstLine = '', ...rest] = form.purpose.trim().split('\n');
    const title = firstLine.trim();
    if (!title) {
      setError('Please write the purpose of the request.');
      return;
    }
    if (!form.items.every((item) => prDateOk(item))) {
      setError('The date of PR cannot be in the past.');
      return;
    }

    // "Prepared by" is the SK Treasurer printed on the sheet.
    const treasurer = officials.find((o) => /treasurer/i.test(o.position || ''));

    // A Project Request is saved as Proposed; the budget is the total of the rows and is
    // worked out by the server. The schedule is set later, in the Planning stage.
    saveMutation.mutate({
      title,
      description: rest.join('\n').trim(),
      requestItems: form.items,
      proposedByName: treasurer ? treasurer.name : '',
      proposedByPosition: treasurer ? treasurer.position : '',
    });
  }

  return (
    <div>
      <PageHeader
        title="Project Management"
        description="Track SK projects, progress, and expenses through liquidation reports."
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            Project Request
          </Button>
        }
      />

      {/* Status filter */}
      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter projects by status">
        {[{ value: '', label: 'All' }, ...statusOptions].map((opt) => {
          const active = filter === opt.value;
          const count = opt.value
            ? allProjects.filter((p) => p.status === opt.value).length
            : allProjects.length;
          return (
            <button
              key={opt.value || 'all'}
              type="button"
              onClick={() => setFilter(opt.value)}
              aria-pressed={active}
              className={`rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors ${
                active
                  ? 'bg-pine text-white'
                  : 'bg-panel text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
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
          <EmptyState
            title="No projects yet"
            description="Send a Project Request to start a project."
            action={
              <Button variant="accent" onClick={openCreate}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                Project Request
              </Button>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const deletionPending = p.deletionRequests?.[0]?.status === 'PENDING';
              // One line saying what the project is waiting for, if anything
              const waiting = deletionPending
                ? 'Deletion requested: awaiting chairman approval'
                : p.status === 'PROPOSED'
                  ? 'Awaiting Barangay Chairman approval'
                  : p.status === 'PLANNING'
                    ? 'Waiting for the schedule'
                    : p.status === 'ONGOING' && !p.canComplete
                      ? 'Liquidation or checklist pending'
                      : p.status === 'ON_HOLD'
                        ? 'On hold'
                        : null;
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  to={`/admin/projects/${p.id}`}
                  notice={waiting}
                  footer={
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                        <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                        Edit
                      </Button>
                      {/* Delete is a quiet menu item, not a red button on every card */}
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
        <DeletionRequestModal project={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        size="xl"
        title={editing ? 'Edit Project' : 'Project Request'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            {/* type=submit + form id so the browser checks the required fields */}
            <Button
              type="submit"
              form="project-form"
              variant="primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form id="project-form" onSubmit={handleSubmit}>
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <ProjectProposalForm
            form={form}
            update={update}
            updateItem={updateItem}
            addItem={addItem}
            removeItem={removeItem}
            officials={officials}
          />
        </form>
      </Modal>
    </div>
  );
}

