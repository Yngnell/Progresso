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

const EMPTY = { eventId: '', from: '', to: '', officialId: '', status: '' };
const STATUS_FILTERS = ['PRESENT', 'ABSENT'];

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

  // "Event: SK General Assembly · Dates: Nov 1 to Nov 30, 2026 · Status: Absent"
  function filtersText() {
    const parts = [];
    if (filters.eventId) parts.push(`Event: ${events.find((e) => e.id === filters.eventId)?.title || 'one event'}`);
    parts.push(`Dates: ${rangeText(filters.from, filters.to)}`);
    if (filters.officialId) parts.push(`Official: ${officials.find((o) => o.id === filters.officialId)?.name || 'one official'}`);
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
        description="Choose filters, then export exactly what the table shows. Present: the official chose their name on the meeting's QR attendance page. Absent: the official was not marked present when the meeting ended."
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
            <select className="input" value={filters.officialId} onChange={set('officialId')}>
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
        <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-slate-200 bg-slate-200 sm:grid-cols-3">
          {[
            ['Present', totals.present],
            ['Absent', totals.absent],
            ['Attendance rate', totals.rate != null ? `${totals.rate}%` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="bg-panel p-4">
              <dt className="section-label">{label}</dt>
              <dd className="font-number text-4xl text-slate-900">{value}</dd>
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
                  : 'Attendance appears here once officials scan a meeting’s QR code and choose their name.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-notebook table-stack">
              <thead>
                <tr>
                  {['Official Name', 'Position', 'Event Name', 'Event Date', 'Status', 'Time Checked In'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.eventId}-${r.officialId || r.officialName}-${i}`}>
                    <td data-label="Official" className="px-4 py-2.5 font-medium text-slate-900">{r.officialName}</td>
                    <td data-label="Position" className="px-4 py-2.5 text-slate-700">{r.position || '—'}</td>
                    <td data-label="Event" className="px-4 py-2.5">
                      <Link to={`/admin/meetings/${r.eventId}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {r.eventName}
                      </Link>
                    </td>
                    <td data-label="Event date" className="px-4 py-2.5 tabular text-slate-700">{formatDate(r.eventDate)}</td>
                    <td data-label="Status" className="px-4 py-2.5">
                      <Badge tone={ATTENDANCE_STATUS[r.status]?.tone}>{ATTENDANCE_STATUS[r.status]?.label || r.status}</Badge>
                    </td>
                    <td data-label="Time checked in" className="px-4 py-2.5 tabular text-slate-700">{r.status === 'PRESENT' && r.timeIn ? formatTime(r.timeIn) : ''}</td>
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
          <h2 className="section-title">Attendance per official</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="table-notebook table-stack">
              <thead>
                <tr>
                  <th className="py-2 pr-3 font-medium">Official</th>
                  <th className="py-2 pr-3 font-medium">Position</th>
                  <th className="py-2 pr-3 text-right font-medium">Present</th>
                  <th className="py-2 pr-3 text-right font-medium">Absent</th>
                  <th className="py-2 text-right font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {data.summary.perOfficial.map((o) => (
                  <tr key={o.name}>
                    <td data-label="Official" className="py-2 pr-3 font-medium text-slate-900">{o.name}</td>
                    <td data-label="Position" className="py-2 pr-3 text-slate-700">{o.position || '—'}</td>
                    <td data-label="Present" className="py-2 pr-3 text-right">{o.present}</td>
                    <td data-label="Absent" className="py-2 pr-3 text-right">{o.absent}</td>
                    <td data-label="Rate" className="py-2 text-right font-medium">{o.rate != null ? `${o.rate}%` : '—'}</td>
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
