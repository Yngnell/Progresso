import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { newsApi } from '../../api/news';
import PageHeader from '../../components/PageHeader';
import {
  Button,
  Card,
  Badge,
  Modal,
  Input,
  Textarea,
  Select,
  EmptyState,
} from '../../components/ui';
import { NEWS_STATUS, formatDate } from '../../utils/format';

const emptyForm = {
  title: '',
  category: '',
  excerpt: '',
  content: '',
  coverImageUrl: '',
  isFeatured: false,
  status: 'DRAFT',
};

export default function AdminNews() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['news', 'all'],
    queryFn: () => newsApi.list({}),
  });
  const news = data?.news || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['news'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing ? newsApi.update(editing.id, payload) : newsApi.create(payload),
    onSuccess: () => {
      invalidate();
      closeModal();
    },
    onError: (err) =>
      setError(err.response?.data?.message || 'Failed to save article'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => newsApi.remove(id),
    onSuccess: invalidate,
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({
      title: item.title || '',
      category: item.category || '',
      excerpt: item.excerpt || '',
      content: item.content || '',
      coverImageUrl: item.coverImageUrl || '',
      isFeatured: item.isFeatured ?? false,
      status: item.status || 'DRAFT',
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

  function handleDelete(item) {
    if (window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(item.id);
    }
  }

  return (
    <div>
      <PageHeader
        title="News & Updates"
        description="Write and publish announcements for the community."
        actions={
          <Button variant="accent" onClick={openCreate}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            New Article
          </Button>
        }
      />

      <div className="mt-6">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : news.length === 0 ? (
          <EmptyState
            title="No articles yet"
            description="Create your first news article to publish on the home page."
            action={
              <Button variant="accent" onClick={openCreate}>
                <Plus size={18} strokeWidth={2} aria-hidden="true" />
                New Article
              </Button>
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {news.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{item.title}</p>
                      {item.isFeatured && (
                        <span className="text-xs text-accent-600">★ Featured</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{item.category || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge tone={NEWS_STATUS[item.status]?.tone || 'slate'}>
                        {NEWS_STATUS[item.status]?.label || item.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {formatDate(item.publishedAt || item.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Article' : 'New Article'}
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
            label="Title *"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              placeholder="e.g. Announcement"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              options={[
                { value: 'DRAFT', label: 'Draft' },
                { value: 'PUBLISHED', label: 'Published' },
              ]}
            />
          </div>
          <Input
            label="Excerpt (short summary)"
            value={form.excerpt}
            onChange={(e) => update('excerpt', e.target.value)}
          />
          <Textarea
            label="Content *"
            rows={6}
            value={form.content}
            onChange={(e) => update('content', e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => update('isFeatured', e.target.checked)}
            />
            Feature on home page
          </label>
        </form>
      </Modal>
    </div>
  );
}
