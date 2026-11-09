import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ExportMenu from '../../components/ExportMenu';
import { reportsApi } from '../../api/reports';
import { settingsApi } from '../../api/settings';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { ATTENDANCE_STATUS, formatDate, formatTime } from '../../utils/format';
import { exportAttendanceExcel, exportAttendancePdf, rangeText } from '../../utils/reportExport';

const EMPTY = { eventId: '', from: '', to: '', userId: '', status: '' };
const STATUS_FILTERS = ['PRESENT', 'LATE', 'ABSENT'];

// Attendance records with filters. The table on screen is exactly what the export contains.
export default function AdminAttendance() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(EMPTY);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const badRange = filters.from && filters.to && filters.from > filters.to;

  // Only the filters that are set are sent.
  const params = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters]
  );
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'attendance', params],
    queryFn: () => reportsApi.attendance(params),
    enabled: !badRange,
    placeholderData: (prev) => prev,
  });
  // The dropdowns list every event and official, whatever the filters.
  const { data: allData } = useQuery({
    queryKey: ['reports', 'attendance', {}],
    queryFn: () => reportsApi.attendance({}),
  });
  const events = allData?.events || [];
  const officials = allData?.officials || [];
  const rows = data?.rows || [];
  const totals = data?.summary?.totals;

  // "Event: SK General Assembly · Dates: Nov 1 to Nov 30, 2026 · Status: Late"
  function filtersText() {
    const parts = [];
    if (filters.eventId) parts.push(`Event: ${events.find((e) => e.id === filters.eventId)?.title || 'one event'}`);
    parts.push(`Dates: ${rangeText(filters.from, filters.to)}`);
    if (filters.userId) parts.push(`Official: ${officials.find((o) => o.id === filters.userId)?.name || 'one official'}`);
    parts.push(`Status: ${filters.status ? ATTENDANCE_STATUS[filters.status].label : 'All'}`);
    return parts.join('  |  ');
  }

  async function onExport(kind) {
    const { settings } = await settingsApi.get();
    const args = { data, settings, user, filters: filtersText() };
    if (kind === 'pdf') await exportAttendancePdf(args);
    else await exportAttendanceExcel(args);
  }

  const filtered = Object.values(filters).some(Boolean);

  return (
    <div>
      <PageHeader
        title="Attendance Records"
        description="Choose filters, then export exactly what the table shows. Absent means the official did not scan and was not recorded by the time the event ended."
        actions={<ExportMenu onExport={onExport} disabled={!data || isLoading || Boolean(badRange)} />}
      />

      {/* Filters */}
      <Card className="mt-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-2">
            <span className="label">Event</span>
            <select className="input" value={filters.eventId} onChange={set('eventId')}>
              <option value="">All events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {formatDate(e.startAt)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">From</span>
            <input type="date" className="input" value={filters.from} max={filters.to || undefined} onChange={set('from')} />
          </label>
          <label>
            <span className="label">To</span>
            <input type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={set('to')} />
          </label>
          <label>
            <span className="label">Status</span>
            <select className="input" value={filters.status} onChange={set('status')}>
              <option value="">All</option>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_STATUS[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="label">Official</span>
            <select className="input" value={filters.userId} onChange={set('userId')}>
              <option value="">All officials</option>
              {officials.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.position ? ` (${o.position})` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            {filtered && (
              <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
                Clear filters
              </Button>
            )}
          </div>
        </div>
        {badRange && <p className="mt-2 text-sm font-medium text-red-700">"From" must be on or before "To".</p>}
      </Card>

      {/* Summary */}
      {totals && (
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {[
            ['Present', totals.present],
            ['Late', totals.late],
            ['Absent', totals.absent],
            ['Attendance rate', totals.rate != null ? `${totals.rate}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-4">
              <dt className="text-sm font-semibold text-slate-600">{label}</dt>
              <dd className="font-display text-4xl font-bold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Records */}
      <Card className="mt-6 p-0">
        {isLoading && !data ? (
          <p className="p-5 text-sm text-slate-600">Loading…</p>
        ) : isError ? (
          <p className="p-5 text-sm font-medium text-red-700">The attendance could not be loaded.</p>
        ) : rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={filtered ? 'No attendance matches these filters' : 'No attendance yet'}
              description={
                filtered
                  ? 'Try another event, date range, official or status.'
                  : 'Attendance appears here once officials scan an event’s QR code.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  {['Official Name', 'Position', 'Event Name', 'Event Date', 'Time In', 'Status', 'Method'].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={`${r.eventId}-${r.userId || r.officialName}-${i}`}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.officialName}</td>
                    <td className="px-4 py-2.5 text-slate-700">{r.position || '—'}</td>
                    <td className="px-4 py-2.5">
                      <Link to={`/admin/calendar/${r.eventId}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {r.eventName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular text-slate-700">{formatDate(r.eventDate)}</td>
                    <td className="px-4 py-2.5 tabular text-slate-700">{r.timeIn ? formatTime(r.timeIn) : '—'}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={ATTENDANCE_STATUS[r.status]?.tone}>{ATTENDANCE_STATUS[r.status]?.label || r.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">{r.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Rate per official */}
      {data?.summary?.perOfficial?.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Attendance per official</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Official</th>
                  <th className="py-2 pr-3 font-semibold">Position</th>
                  <th className="py-2 pr-3 text-right font-semibold">Present</th>
                  <th className="py-2 pr-3 text-right font-semibold">Late</th>
                  <th className="py-2 pr-3 text-right font-semibold">Absent</th>
                  <th className="py-2 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular">
                {data.summary.perOfficial.map((o) => (
                  <tr key={o.name}>
                    <td className="py-2 pr-3 font-medium text-slate-900">{o.name}</td>
                    <td className="py-2 pr-3 text-slate-700">{o.position || '—'}</td>
                    <td className="py-2 pr-3 text-right">{o.present}</td>
                    <td className="py-2 pr-3 text-right">{o.late}</td>
                    <td className="py-2 pr-3 text-right">{o.absent}</td>
                    <td className="py-2 text-right font-semibold">{o.rate != null ? `${o.rate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
