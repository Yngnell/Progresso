import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CircleCheck, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from './ui';
import { ProgressBar, progressSummary } from './ProjectCard';
import { formatDate, formatDateTime } from '../utils/format';

// Progress card: the project's checklist (which drives the progress percentage) and its
// linked events. Permissions:
//   onAdd / onRename / onRemove  the SK Chairperson or the SK Admin (manage items)
//   onToggle                     the officials and the admin (check items off)
// Omit them for a read-only view (the public page, the Barangay Chairman).
export default function ProjectChecklist({
  project,
  onAdd,
  onRename,
  onToggle,
  onRemove,
  adding = false,
  error = '',
  eventLink,
}) {
  const [form, setForm] = useState({ title: '', dueDate: '' });
  const [editing, setEditing] = useState(null); // { id, title }
  const tasks = project.tasks || [];
  const events = project.events || [];
  const now = new Date();
  const summary = progressSummary(project.progressBreakdown);
  const done = tasks.filter((t) => t.done).length;

  function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd(form, () => setForm({ title: '', dueDate: '' }));
  }

  function saveEdit(e) {
    e.preventDefault();
    const t = tasks.find((x) => x.id === editing.id);
    if (t && editing.title.trim() && editing.title.trim() !== t.title) onRename(t, editing.title.trim());
    setEditing(null);
  }

  return (
    <div>
      <ProgressBar value={project.progress} breakdown={project.progressBreakdown} />
      {summary && <p className="mt-2 text-sm text-slate-600">{summary}</p>}

      {/* Checklist */}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold text-slate-900">Checklist</h3>
        {tasks.length > 0 && (
          <p className="text-sm font-semibold text-slate-700">
            {done} of {tasks.length} done
          </p>
        )}
      </div>
      <p className="text-sm text-slate-600">
        Progress = checked items ÷ all items × 100. A project reaches 100% when it is marked Completed.
      </p>
      {onAdd && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
          <input
            className="input min-w-[160px] flex-1"
            placeholder="New checklist item"
            aria-label="New checklist item"
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="input w-44"
            type="date"
            aria-label="Due date (optional)"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            title="Due date (optional)"
          />
          <Button type="submit" variant="primary" disabled={adding}>
            <Plus size={18} strokeWidth={2} aria-hidden="true" />
            Add item
          </Button>
        </form>
      )}
      {error && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="mt-3 text-slate-600">
          No checklist items yet.
          {onAdd ? ' Add the steps of this project above.' : ''}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {tasks.map((t) => {
            const late = !t.done && t.dueDate && new Date(t.dueDate) < now;
            const isEditing = editing?.id === t.id;
            return (
              <li key={t.id} className="flex items-start gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-600 disabled:cursor-default"
                  checked={t.done}
                  disabled={!onToggle}
                  onChange={() => onToggle?.(t)}
                  aria-label={`${t.title}: ${t.done ? 'done' : 'not done'}`}
                />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <form onSubmit={saveEdit} className="flex flex-wrap gap-2">
                      <input
                        className="input min-w-[160px] flex-1"
                        aria-label="Item name"
                        maxLength={200}
                        value={editing.title}
                        onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                        autoFocus
                      />
                      <Button type="submit" size="sm" variant="primary" disabled={!editing.title.trim()}>
                        <Check size={16} strokeWidth={2} aria-hidden="true" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        <X size={16} strokeWidth={2} aria-hidden="true" />
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <p className={t.done ? 'text-slate-500 line-through' : 'font-medium text-slate-900'}>{t.title}</p>
                  )}
                  {t.done && (t.completedByName || t.completedAt) && (
                    <p className="text-sm text-green-800">
                      Done{t.completedByName ? ` by ${t.completedByName}` : ''}
                      {t.completedAt ? `, ${formatDate(t.completedAt)}` : ''}
                    </p>
                  )}
                </div>
                {t.dueDate && !isEditing && (
                  <span className={`shrink-0 text-sm ${late ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                    {late ? 'Late · ' : 'Due '}
                    {formatDate(t.dueDate)}
                  </span>
                )}
                {onRename && !isEditing && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    onClick={() => setEditing({ id: t.id, title: t.title })}
                    aria-label={`Edit item ${t.title}`}
                  >
                    <Pencil size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
                {onRemove && !isEditing && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onRemove(t)}
                    aria-label={`Delete item ${t.title}`}
                  >
                    <Trash2 size={17} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Linked events */}
      <h3 className="mt-7 text-lg font-bold text-slate-900">Scheduled sessions (linked events)</h3>
      <p className="text-sm text-slate-600">
        When a project has no checklist items, each held session counts toward progress.
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-slate-600">
          No sessions linked yet.
          {onAdd && ' Link one from the Calendar by choosing this project.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {events.map((ev) => {
            const held = new Date(ev.endAt || ev.startAt) <= now;
            const title = eventLink ? (
              <Link to={eventLink(ev)} className="font-medium text-brand-700 hover:text-brand-800">
                {ev.title}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{ev.title}</span>
            );
            return (
              <li key={ev.id} className="flex items-center gap-3 py-2.5">
                {held ? (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CircleCheck size={17} strokeWidth={1.75} aria-hidden="true" /> Held
                  </span>
                ) : (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Clock size={17} strokeWidth={1.75} aria-hidden="true" /> Upcoming
                  </span>
                )}
                <span className="min-w-0 flex-1">{title}</span>
                <span className="hidden text-sm text-slate-600 sm:block">{formatDateTime(ev.startAt)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
