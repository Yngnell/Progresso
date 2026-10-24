import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../api/projects';
import { officialsApi } from '../../api/officials';
import { useAuth } from '../../context/AuthContext';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import OverflowMenu from '../../components/OverflowMenu';
import { Button, Modal, EmptyState } from '../../components/ui';
import { PROJECT_STATUS, toDateTimeLocal } from '../../utils/format';
import { ProjectCard } from '../../components/ProjectCard';

import PageHeader from '../../components/PageHeader';
import DeletionRequestModal from '../../components/DeletionRequestModal';
import ProjectProposalForm, { emptyItem } from '../../components/ProjectProposalForm';

const statusOptions = Object.entries(PROJECT_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

// A fresh form: one empty purchase request row, to which the + button adds more.
const blankForm = () => ({
  purpose: '', // first line = project name, the rest = description
  items: [{ ...emptyItem }],
  startDate: '',
  endDate: '',
});

export default function AdminProjects() {
  const { user } = useAuth();
  const readOnly = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
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
      requestedBy: r.requestedBy || '',
      amount: r.amount != null ? String(r.amount) : '',
    }));
    setForm({
      // Name on the first line and the description below it, so saving keeps both.
      purpose: project.description ? `${project.title}\n${project.description}` : project.title || '',
      items: rows.length > 0 ? rows : [{ ...emptyItem }],
      startDate: toDateTimeLocal(project.startDate),
      endDate: toDateTimeLocal(project.endDate),
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
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError('The end date and time must be after the start.');
      return;
    }

    // The purpose of request is the project: first line = name, the rest = description.
    const [firstLine = '', ...rest] = form.purpose.trim().split('\n');
    const title = firstLine.trim();
    if (!title) {
      setError('Please write the purpose of the request.');
      return;
    }

    // "Prepared by" is the SK Treasurer printed on the sheet.
    const treasurer = officials.find((o) => /treasurer/i.test(o.position || ''));

    // datetime-local has no time zone; sending an ISO string stores the exact moment
    // chosen in the browser's (Philippine) time. The budget is the total of the rows
    // and is worked out by the server.
    saveMutation.mutate({
      title,
      description: rest.join('\n').trim(),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      requestItems: form.items,
      proposedByName: treasurer ? treasurer.name : '',
      proposedByPosition: treasurer ? treasurer.position : '',
    });
  }

  return (
    <div>
      <PageHeader
        title="Project Management"
        description="Track SK projects, budgets, progress, and expenses."
        actions={
          !readOnly && (
            <Button variant="accent" onClick={openCreate}>
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              Add Project
            </Button>
          )
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
                  ? 'bg-brand-900 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-100'
              }`}
            >
              {opt.label}
              <span className="ml-1.5 font-display text-base opacity-80">{count}</span>
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
            description={
              readOnly
                ? 'Projects will appear here once the SK creates them.'
                : 'Create your first SK project to start tracking progress.'
            }
            action={
              readOnly ? undefined : (
                <Button variant="accent" onClick={openCreate}>
                  <Plus size={18} strokeWidth={2} aria-hidden="true" />
                  Add Project
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const deletionPending = p.deletionRequests?.[0]?.status === 'PENDING';
              // One line saying what the project is waiting for, if anything
              const waiting =
                p.approvalState === 'REJECTED'
                  ? 'Proposal rejected by the chairman'
                  : p.status === 'PROPOSED'
                    ? p.approvalState === 'RETURNED'
                      ? 'Returned by the chairman: needs revision'
                      : 'Awaiting chairman approval'
                    : deletionPending
                      ? 'Deletion requested: awaiting chairman approval'
                      : null;
              return (
                <ProjectCard
                  key={p.id}
                  project={p}
                  to={`/admin/projects/${p.id}`}
                  notice={waiting}
                  footer={
                    <div className="flex flex-wrap items-center gap-2">
                      {p.status !== 'PROPOSED' && p.approvalState !== 'REJECTED' && (
                        <Link to={`/admin/projects/${p.id}/report`}>
                          <Button size="sm" variant="secondary">
                            <FileText size={16} strokeWidth={1.75} aria-hidden="true" />
                            Report
                          </Button>
                        </Link>
                      )}
                      {!readOnly && p.approvalState !== 'REJECTED' && (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                          Edit
                        </Button>
                      )}
                      {/* Delete is a quiet menu item, not a red button on every card */}
                      {!readOnly && (
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
                      )}
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
        title={editing ? 'Edit Project' : 'Add Project'}
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

