import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../../api/events';
import { attendanceApi } from '../../api/attendance';
import { reportsApi } from '../../api/reports';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import DateTile from '../../components/DateTile';
import EventTypeIcon from '../../components/EventTypeIcon';
import { AttendanceQrButton } from '../../components/AttendanceQr';
import { Card, Badge, Button } from '../../components/ui';
import { EVENT_TYPE, ATTENDANCE_STATUS, formatDateTime, formatTime } from '../../utils/format';

const statusOptions = Object.entries(ATTENDANCE_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function AdminEventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  // Only the SK Admin changes attendance by hand; the others view it.
  const readOnly = user?.role !== 'ADMIN';
  const qc = useQueryClient();

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
    qc.invalidateQueries({ queryKey: ['reports'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ recordId, data }) => attendanceApi.updateRecord(recordId, data),
    onSuccess: invalidate,
  });

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
        {user?.isSkChair && <AttendanceQrButton event={event} size="md" />}
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

      {/* Officials check themselves in with the QR code; the admin can still record or change one */}
      <div className="mt-6">
        <Card className="p-5">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">
            Attendees ({records.length})
          </h2>
          {!readOnly && <ManualRecordForm eventId={id} records={records} onDone={invalidate} />}
          <div className="mt-4">
            {records.length === 0 ? (
              <p className="text-slate-600">
                No attendees yet. The SK Chairperson shows the attendance QR code at the event, and
                officials scan it to record their attendance.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2">Participant</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Time In</th>
                      <th className="py-2">Method</th>
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
                              aria-label={`Status of ${r.participant}`}
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
                        <td className="py-2 text-slate-600">{formatTime(r.timeIn) || '—'}</td>
                        <td className="py-2 text-slate-600">{r.method === 'MANUAL' ? 'Manual' : 'QR'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Admin: record an official who could not scan (e.g. no phone), or mark someone Absent or
// Excused. Saved with the method "Manual".
function ManualRecordForm({ eventId, records, onDone }) {
  const { data } = useQuery({
    queryKey: ['reports', 'attendance', { eventId }],
    queryFn: () => reportsApi.attendance({ eventId }),
  });
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState('PRESENT');
  const [error, setError] = useState('');
  const recorded = new Set(records.map((r) => r.userId).filter(Boolean));
  const officials = (data?.officials || []).filter((o) => !recorded.has(o.id));

  const add = useMutation({
    mutationFn: () => attendanceApi.addManual(eventId, { userId, status }),
    onSuccess: () => {
      setUserId('');
      setError('');
      onDone();
    },
    onError: (err) => setError(err.response?.data?.message || 'The attendance could not be recorded.'),
  });

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (userId) add.mutate();
      }}
    >
      <label className="min-w-[12rem] flex-1">
        <span className="label">Record by hand</span>
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Choose an official…</option>
          {officials.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.position ? ` (${o.position})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Status</span>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" disabled={!userId || add.isPending}>
        <Plus size={16} strokeWidth={2} aria-hidden="true" />
        Add
      </Button>
      {error && (
        <p className="w-full text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
