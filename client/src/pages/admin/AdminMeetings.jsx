import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../api/events';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/roles';
import PageHeader from '../../components/PageHeader';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import { AttendanceQrButton } from '../../components/AttendanceQr';
import AttendanceSettings from '../../components/AttendanceSettings';
import MonthCalendar, { MONTHS } from '../../components/MonthCalendar';
import { Button, Card, Modal, Input } from '../../components/ui';
import ConfirmDialog from '../../components/ConfirmDialog';
import { formatDateTime, toDateTimeLocal } from '../../utils/format';

// Every event is a Meeting (the server names it "Meeting").
const emptyForm = {
  startAt: '',
  endAt: '',
  meetingLink: '',
};

// A meeting is finished once its end (or, without an end, its start) has passed:
// it can then no longer be edited or deleted.
const isFinished = (e) => new Date(e.endAt || e.startAt) <= new Date();

export default function AdminMeetings() {
  const { user } = useAuth();
  // Only the SK Admin adds and edits events; the chairman and the officials view them.
  const readOnly = !isAdmin(user);
  const qc = useQueryClient();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [confirmSave, setConfirmSave] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['events', 'admin'],
    queryFn: () => eventsApi.list({}),
  });

  const events = data?.events || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['events'] });
    qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editing ? eventsApi.update(editing.id, payload) : eventsApi.create(payload),
    onSuccess: () => {
      invalidate();
      setConfirmSave(false);
      closeModal();
    },
    onError: (err) => {
      setConfirmSave(false);
      setError(err.response?.data?.message || 'Failed to save event');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => eventsApi.remove(id),
    onSuccess: invalidate,
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); } else { setMonth(month - 1); }
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); } else { setMonth(month + 1); }
  }

  function openCreate(dayK) {
    setEditing(null);
    // A day in the past opens an empty start (past dates and times are not allowed).
    const start = dayK && new Date(`${dayK}T09:00`) > new Date() ? `${dayK}T09:00` : '';
    setForm({ ...emptyForm, startAt: start });
    setError('');
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditing(event);
    setForm({
      startAt: toDateTimeLocal(event.startAt),
      endAt: toDateTimeLocal(event.endAt),
      meetingLink: event.meetingLink || '',
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
    const now = new Date();
    if (!form.startAt) return setError('Enter the start date and time.');
    if (new Date(form.startAt) < now || (form.endAt && new Date(form.endAt) < now)) {
      return setError('The date and time cannot be in the past.');
    }
    if (form.endAt && new Date(form.endAt) <= new Date(form.startAt)) {
      return setError('The end date and time must be after the start.');
    }
    // A new meeting is confirmed first ("Save this meeting?"); an edit saves at once.
    if (editing) save();
    else setConfirmSave(true);
  }

  function save() {
    // datetime-local has no time zone; convert it here so the server stores the
    // exact moment picked (in the browser's Philippine time), not the same clock time in UTC.
    const toIso = (v) => (v ? new Date(v).toISOString() : '');
    saveMutation.mutate({ ...form, startAt: toIso(form.startAt), endAt: toIso(form.endAt) });
  }

  function handleDelete(event) {
    if (window.confirm(`Delete "${event.title}"?`)) {
      deleteMutation.mutate(event.id);
    }
  }

  // Earliest date and time the pickers allow: now (past dates and times are disabled).
  const nowLocal = toDateTimeLocal(new Date());

  const selectedEvents = selectedDay
    ? events.filter((e) => {
        const k = new Date(e.startAt);
        const pad = (n) => String(n).padStart(2, '0');
        const key = `${k.getFullYear()}-${pad(k.getMonth() + 1)}-${pad(k.getDate())}`;
        return key === selectedDay;
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Schedule SK meetings and record their attendance."
        actions={
          !readOnly && (
            <Button variant="accent" onClick={() => openCreate(selectedDay)}>
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              Add Event
            </Button>
          )
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden sm:inline">Prev</span>
            </button>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
              {MONTHS[month]} {year}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
              aria-label="Next month"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <MonthCalendar
            year={year}
            month={month}
            events={events}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </Card>

        {/* Selected day / upcoming list */}
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            {selectedDay ? `Events on ${selectedDay}` : 'Upcoming Events'}
          </h2>
          <div className="mt-3 space-y-3">
            {(selectedDay ? selectedEvents : events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 6)).length === 0 ? (
              <p className="text-slate-600">No events to show.</p>
            ) : (
              (selectedDay ? selectedEvents : events.filter((e) => new Date(e.startAt) >= new Date()).slice(0, 6)).map((e) => {
                return (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <DateTile date={e.startAt} className="h-12 w-12" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <EventTypeIcon type={e.type} size={15} className="text-brand-600" />
                          <span className="truncate">{e.title}</span>
                        </p>
                        <p className="text-sm text-slate-600">{formatDateTime(e.startAt)}</p>
                      </div>
                    </div>
                    {user?.role === 'ADMIN' && <AttendanceQrButton event={e} className="mt-3 w-full" />}
                    <div className="mt-3 flex gap-2">
                      <Link to={`/admin/meetings/${e.id}`} className="flex-1">
                        <Button size="sm" variant="secondary" className="w-full">
                          Attendance
                        </Button>
                      </Link>
                      {!readOnly && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(e)}
                            disabled={isFinished(e)}
                            title={isFinished(e) ? 'This meeting has ended' : undefined}
                            aria-label={`Edit ${e.title}`}
                          >
                            <Pencil size={16} strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(e)}
                            disabled={isFinished(e)}
                            title={isFinished(e) ? 'This meeting has ended' : undefined}
                            aria-label={`Delete ${e.title}`}
                          >
                            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Attendance settings: the defaults for new attendance QR codes (SK Admin) */}
      {user?.role === 'ADMIN' && (
        <div className="mt-6">
          <AttendanceSettings />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Event' : 'Add Event'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Input label="Type" value="Meeting" disabled readOnly />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start *"
              type="datetime-local"
              value={form.startAt}
              min={nowLocal}
              onChange={(e) => update('startAt', e.target.value)}
              required
            />
            <Input
              label="End"
              type="datetime-local"
              value={form.endAt}
              min={form.startAt || nowLocal}
              onChange={(e) => update('endAt', e.target.value)}
            />
          </div>
          <Input
            label="Meeting Link (optional)"
            value={form.meetingLink}
            onChange={(e) => update('meetingLink', e.target.value)}
          />
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmSave}
        message="Save this meeting?"
        confirmLabel="Save"
        busy={saveMutation.isPending}
        onConfirm={save}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}
