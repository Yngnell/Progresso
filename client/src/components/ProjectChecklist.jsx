import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Clock, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui';
import { ProgressBar, progressSummary } from './ProjectCard';
import { formatDate, formatDateTime } from '../utils/format';

// Progress card listing the work items that drive a project's progress:
// linked events (done once their time passes) and checklist tasks.
// Pass onAdd/onToggle/onRemove to make the checklist editable (admin);
// omit them for a read-only view (public).
export default function ProjectChecklist({
  project,
  onAdd,
  onToggle,
  onRemove,
  adding = false,
  error = '',
  eventLink,
}) {
  const [form, setForm] = useState({ title: '', dueDate: '' });
  const editable = Boolean(onAdd);
  const tasks = project.tasks || [];
  const events = project.events || [];
  const now = new Date();
  const summary = progressSummary(project.progressBreakdown);

  function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onAdd(form, () => setForm({ title: '', dueDate: '' }));
  }

  return (
    <div>
      <ProgressBar value={project.progress} breakdown={project.progressBreakdown} />
      {summary && <p className="mt-2 text-sm text-slate-600">{summary}</p>}

      {/* Checklist tasks */}
      <h3 className="mt-6 text-lg font-bold text-slate-900">Checklist</h3>
      <p className="text-sm text-slate-600">
        Project stages and to-dos. These do not change the progress percentage.
      </p>
      {editable && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap gap-2">
          <input
            className="input min-w-[160px] flex-1"
            placeholder="New task"
            aria-label="New task"
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
            Add
          </Button>
        </form>
      )}
      {error && <p className="mt-2 text-sm font-medium text-red-700">{error}</p>}

      {tasks.length === 0 ? (
        <p className="mt-3 text-slate-600">No checklist tasks yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {tasks.map((t) => {
            const late = !t.done && t.dueDate && new Date(t.dueDate) < now;
            return (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 cursor-pointer disabled:cursor-default"
                  checked={t.done}
                  disabled={!editable}
                  onChange={() => onToggle?.(t)}
                  aria-label={`${t.title}: ${t.done ? 'done' : 'not done'}`}
                />
                <span
                  className={`flex-1 ${
                    t.done ? 'text-slate-500 line-through' : 'font-medium text-slate-900'
                  }`}
                >
                  {t.title}
                </span>
                {t.dueDate && (
                  <span
                    className={`text-sm ${late ? 'font-semibold text-red-700' : 'text-slate-600'}`}
                  >
                    {late ? 'Late · ' : 'Due '}
                    {formatDate(t.dueDate)}
                  </span>
                )}
                {editable && (
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    onClick={() => onRemove(t)}
                    aria-label={`Remove task ${t.title}`}
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
        Each session counts toward progress once it has been held.
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-slate-600">
          No sessions linked yet.
          {editable && ' Link one from the Calendar by choosing this project.'}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {events.map((ev) => {
            const done = new Date(ev.endAt || ev.startAt) <= now;
            const title = eventLink ? (
              <Link to={eventLink(ev)} className="font-medium text-brand-700 hover:text-brand-800">
                {ev.title}
              </Link>
            ) : (
              <span className="font-medium text-slate-900">{ev.title}</span>
            );
            return (
              <li key={ev.id} className="flex items-center gap-3 py-2.5">
                {done ? (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-green-700">
                    <CircleCheck size={17} strokeWidth={1.75} aria-hidden="true" /> Held
                  </span>
                ) : (
                  <span className="inline-flex w-24 shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-600">
                    <Clock size={17} strokeWidth={1.75} aria-hidden="true" /> Upcoming
                  </span>
                )}
                <span className="min-w-0 flex-1">{title}</span>
                <span className="hidden text-sm text-slate-600 sm:block">
                  {formatDateTime(ev.startAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
