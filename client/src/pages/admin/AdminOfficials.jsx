import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { officialsApi } from '../../api/officials';
import {
  Button,
  Card,
  Badge,
  Modal,
  Input,
  Textarea,
  EmptyState,
} from '../../components/ui';

const emptyForm = {
  name: '',
  position: '',
  committee: '',
  contact: '',
  bio: '',
  photoUrl: '',
  termStart: '',
  termEnd: '',
  displayOrder: 0,
  isActive: true,
};

export default function AdminOfficials() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['officials', 'all'],
    queryFn: () => officialsApi.list({}),
  });
  const officials = data?.officials || [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['officials'] });

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing ? officialsApi.update(editing.id, payload) : officialsApi.create(payload),
    onSuccess: () => {
      invalidate();
      closeModal();
    },
    onError: (err) =>
      setError(err.response?.data?.message || 'Failed to save official'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => officialsApi.remove(id),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(official) {
    setEditing(official);
    setForm({
      name: official.name || '',
      position: official.position || '',
      committee: official.committee || '',
      contact: official.contact || '',
      bio: official.bio || '',
      photoUrl: official.photoUrl || '',
      termStart: official.termStart ? official.termStart.slice(0, 10) : '',
      termEnd: official.termEnd ? official.termEnd.slice(0, 10) : '',
      displayOrder: official.displayOrder ?? 0,
      isActive: official.isActive ?? true,
    });
    setError('');
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  }

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    saveMutation.mutate(form);
  }

  function handleDelete(official) {
    if (window.confirm(`Delete ${official.name}? This cannot be undone.`)) {
      deleteMutation.mutate(official.id);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Officials Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the SK and barangay officials shown on the public site.
          </p>
        </div>
        <Button variant="accent" onClick={openCreate}>
          + Add Official
        </Button>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : officials.length === 0 ? (
          <EmptyState
            title="No officials yet"
            description="Add your first official to populate the public directory."
            action={
              <Button variant="accent" onClick={openCreate}>
                + Add Official
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {officials.map((o) => (
              <Card key={o.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold">
                      {o.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{o.name}</p>
                      <p className="text-sm text-brand-600">{o.position}</p>
                    </div>
                  </div>
                  <Badge tone={o.isActive ? 'green' : 'slate'}>
                    {o.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {o.committee && (
                  <p className="mt-3 text-xs text-slate-400">Committee: {o.committee}</p>
                )}
                {o.contact && (
                  <p className="mt-1 text-xs text-slate-400">Contact: {o.contact}</p>
                )}

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(o)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(o)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Official' : 'Add Official'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Input
            label="Full Name *"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            required
          />
          <Input
            label="Position *"
            value={form.position}
            onChange={(e) => update('position', e.target.value)}
            placeholder="e.g. SK Chairperson"
            required
          />
          <Input
            label="Committee"
            value={form.committee}
            onChange={(e) => update('committee', e.target.value)}
          />
          <Input
            label="Contact"
            value={form.contact}
            onChange={(e) => update('contact', e.target.value)}
            placeholder="e.g. 0917 123 4567"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Term Start"
              type="date"
              value={form.termStart}
              onChange={(e) => update('termStart', e.target.value)}
            />
            <Input
              label="Term End"
              type="date"
              value={form.termEnd}
              onChange={(e) => update('termEnd', e.target.value)}
            />
          </div>
          <Input
            label="Display Order"
            type="number"
            value={form.displayOrder}
            onChange={(e) => update('displayOrder', e.target.value)}
          />
          <Textarea
            label="Bio"
            rows={3}
            value={form.bio}
            onChange={(e) => update('bio', e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
            />
            Active (shown on public site)
          </label>
        </form>
      </Modal>
    </div>
  );
}
