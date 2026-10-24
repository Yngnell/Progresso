import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../api/events';
import { attendanceApi } from '../../api/attendance';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import { Button, Card, Badge, Input, Select } from '../../components/ui';
import { EVENT_TYPE, ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

const statusOptions = Object.entries(ATTENDANCE_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function AdminEventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const readOnly = user?.role === 'CHAIRMAN';
  const qc = useQueryClient();
  const [participant, setParticipant] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [error, setError] = useState('');

  const { data: eventData, isLoading, isError } = useQuery({
    queryKey: ['events', id],
    queryFn: () => eventsApi.get(id),
  });
  const { data: attData } = useQuery({
    queryKey: ['attendance', id],
    queryFn: () => attendanceApi.list(id),
  });

  const event = eventData?.event;
  const records = attData?.records || [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['attendance', id] });
  };

  const markMutation = useMutation({
    mutationFn: (payload) => attendanceApi.mark(id, payload),
    onSuccess: () => {
      invalidate();
      setParticipant('');
      setStatus('PRESENT');
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to mark attendance'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ recordId, data }) => attendanceApi.updateRecord(recordId, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (recordId) => attendanceApi.removeRecord(recordId),
    onSuccess: invalidate,
  });

  function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!participant.trim()) return;
    markMutation.mutate({ participant: participant.trim(), status });
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (isError || !event)
    return (
      <div className="text-center">
        <p className="text-slate-600">Event not found.</p>
        <Link to="/admin/calendar" className="mt-2 inline-block text-brand-600">
          ← Back to Calendar
        </Link>
      </div>
    );

  const t = EVENT_TYPE[event.type] || { label: event.type };

  // Tally counts.
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  records.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });

  return (
    <div>
      <Link
        to="/admin/calendar"
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
      >
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Calendar
      </Link>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        <DateTile date={event.startAt} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-slate-900">
            {event.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-slate-700">
            <EventTypeIcon type={event.type} size={17} className="text-brand-600" />
            {t.label} · {formatDateTime(event.startAt)}
          </p>
        </div>
      </div>

      {/* Summary: the four attendance counts in a single strip */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        {Object.entries(ATTENDANCE_STATUS).map(([key, v]) => (
          <div key={key} className="bg-white p-4">
            <dt className="text-sm font-semibold text-slate-600">{v.label}</dt>
            <dd className="font-display text-4xl font-bold text-slate-900">{counts[key] || 0}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Add attendee (admin only) */}
        {!readOnly && (
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Mark Attendance</h2>
          <form onSubmit={handleAdd} className="mt-4 space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Input
              label="Participant name *"
              value={participant}
              onChange={(e) => setParticipant(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              required
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={statusOptions}
            />
            <Button type="submit" variant="primary" className="w-full" disabled={markMutation.isPending}>
              <Plus size={18} strokeWidth={2} aria-hidden="true" />
              {markMutation.isPending ? 'Adding…' : 'Add Attendee'}
            </Button>
          </form>
        </Card>
        )}

        {/* Attendance list */}
        <Card className={`p-5 ${readOnly ? 'lg:col-span-3' : 'lg:col-span-2'}`}>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            Attendees ({records.length})
          </h2>
          <div className="mt-4">
            {records.length === 0 ? (
              <p className="text-slate-600">No attendees recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Participant</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Time In</th>
                    {!readOnly && <th className="py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 text-slate-700">{r.participant}</td>
                      <td className="py-2">
                        {readOnly ? (
                          <Badge tone={ATTENDANCE_STATUS[r.status]?.tone}>
                            {ATTENDANCE_STATUS[r.status]?.label || r.status}
                          </Badge>
                        ) : (
                          <select
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                            value={r.status}
                            onChange={(e) =>
                              updateMutation.mutate({
                                recordId: r.id,
                                data: { status: e.target.value },
                              })
                            }
                          >
                            {statusOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 text-slate-500">{formatTime(r.timeIn) || '—'}</td>
                      {!readOnly && (
                        <td className="py-2 text-right">
                          <button
                            className="text-xs text-red-600 hover:text-red-700"
                            onClick={() => deleteMutation.mutate(r.id)}
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
