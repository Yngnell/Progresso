import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, ExternalLink, Search } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import ExportMenu from '../../components/ExportMenu';
import { Card, EmptyState, Input, Select } from '../../components/ui';
import { projectsApi } from '../../api/projects';
import { settingsApi } from '../../api/settings';
import { useAuth } from '../../context/AuthContext';
import { exportFilesExcel, exportFilesPdf } from '../../utils/reportExport';
import { formatDate, formatPeso2, phDayOf, phToday } from '../../utils/format';

// Files: every file of the SK projects in one spreadsheet-like table, for the Barangay
// Chairman. Filter by project, document type, and period (this month, this year, or a range),
// search by name, sort by any column, open or download a file, and export the list.

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'range', label: 'Date range' },
];

const COLUMNS = [
  { key: 'name', label: 'File name', get: (f) => f.originalName.toLowerCase() },
  { key: 'type', label: 'Document type', get: (f) => f.typeLabel.toLowerCase() },
  { key: 'project', label: 'Project', get: (f) => f.project.title.toLowerCase() },
  { key: 'status', label: 'Status', get: (f) => f.statusText.toLowerCase() },
  { key: 'by', label: 'Uploaded by', get: (f) => (f.uploadedByName || '').toLowerCase() },
  { key: 'date', label: 'Date uploaded', get: (f) => f.createdAt },
  { key: 'amount', label: 'Amount', get: (f) => (f.amount == null ? -1 : Number(f.amount)), right: true },
];

export default function ChairmanFiles() {
  const { user } = useAuth();
  const [project, setProject] = useState('');
  const [type, setType] = useState('');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [problem, setProblem] = useState('');

  const { data, isLoading, isError } = useQuery({ queryKey: ['project-files'], queryFn: projectsApi.listFiles });
  const documentTypes = data?.documentTypes || {};

  const all = useMemo(
    () =>
      (data?.files || []).map((f) => ({
        ...f,
        // A Purchase Request shows its PR No. (MM-NNN-YYYY) next to the type.
        typeLabel: (documentTypes[f.documentType] || f.documentType || '—') + (f.prNo ? ` · ${f.prNo}` : ''),
        statusText: f.project.archivedAt ? `${f.project.statusLabel} (deleted)` : f.project.statusLabel,
        day: phDayOf(f.createdAt),
      })),
    [data, documentTypes]
  );
  const today = phToday();
  // One test for every filter. `skip` leaves one filter out, so each dropdown can count what
  // its options would show under the other filters (choosing a project updates the type counts).
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (f, skip) => {
      if (skip !== 'project' && project && f.project.id !== project) return false;
      if (skip !== 'type' && type && f.documentType !== type) return false;
      if (period === 'month' && f.day.slice(0, 7) !== today.slice(0, 7)) return false;
      if (period === 'year' && f.day.slice(0, 4) !== today.slice(0, 4)) return false;
      if (period === 'range' && ((from && f.day < from) || (to && f.day > to))) return false;
      if (q && !f.originalName.toLowerCase().includes(q) && !f.project.title.toLowerCase().includes(q) && !(f.prNo || '').toLowerCase().includes(q)) return false;
      return true;
    };
  }, [project, type, period, from, to, search, today]);

  // Project options: every project with files, with how many match the other filters.
  const projects = useMemo(() => {
    const m = new Map();
    all.forEach((f) => m.set(f.project.id, { title: f.project.title, count: 0 }));
    all.forEach((f) => { if (matches(f, 'project')) m.get(f.project.id).count += 1; });
    return [...m].map(([id, v]) => [id, v.title, v.count]).sort((a, b) => a[1].localeCompare(b[1]));
  }, [all, matches]);
  // Document type options: only the types found under the other filters, with their count.
  // The chosen type stays listed (with 0) so the select never shows a missing value.
  const typeCounts = useMemo(() => {
    const c = {};
    all.forEach((f) => { if (matches(f, 'type')) c[f.documentType] = (c[f.documentType] || 0) + 1; });
    if (type && !c[type]) c[type] = 0;
    return c;
  }, [all, matches, type]);

  const shown = useMemo(() => {
    const list = all.filter((f) => matches(f));
    const col = COLUMNS.find((c) => c.key === sort.key) || COLUMNS[5];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [all, matches, sort]);

  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'date' || key === 'amount' ? 'desc' : 'asc' }));
  const fail = (text) => (err) => setProblem(err?.response?.data?.message || text);
  const open = (f) => {
    setProblem('');
    projectsApi.openFile(f.project.id, f.id).catch(fail('The file could not be opened.'));
  };
  const save = (f) => {
    setProblem('');
    projectsApi.downloadFile(f.project.id, f.id, f.originalName).catch(fail('The file could not be downloaded.'));
  };

  // What the list shows, in words (for the export).
  const periodText =
    period === 'month' ? `This month (${new Date(`${today}T00:00:00+08:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })})`
      : period === 'year' ? `This year (${today.slice(0, 4)})`
        : period === 'range' ? `${from ? formatDate(from) : 'Start'} to ${to ? formatDate(to) : 'today'}`
          : 'All time';
  async function onExport(kind) {
    const { settings } = await settingsApi.get();
    const args = {
      files: shown,
      filters: [
        ['Project', project ? projects.find(([id]) => id === project)?.[1] : 'All projects'],
        ['Document type', type ? documentTypes[type] || type : 'All types'],
        ['Period', periodText],
        ...(search.trim() ? [['Search', search.trim()]] : []),
      ],
      settings,
      user,
    };
    if (kind === 'pdf') await exportFilesPdf(args);
    else await exportFilesExcel(args);
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Files"
        description="Every file of the SK projects in one table. Filter by project, document type, or period, sort by any column, and open or download a file."
        actions={<ExportMenu onExport={onExport} disabled={isLoading || !shown.length} />}
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Project"
            value={project}
            onChange={(e) => setProject(e.target.value)}
            options={[{ value: '', label: 'All projects' }, ...projects.map(([value, label, count]) => ({ value, label: `${label} (${count})` }))]}
          />
          <Select
            label="Document type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              { value: '', label: 'All types' },
              ...Object.entries(documentTypes)
                .filter(([value]) => value in typeCounts)
                .map(([value, label]) => ({ value, label: `${label} (${typeCounts[value]})` })),
            ]}
          />
          <Select label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} />
          <div>
            <label className="label" htmlFor="file-search">Search</label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="file-search"
                type="search"
                className="input pl-9"
                placeholder="File, project, or PR No."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {period === 'range' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </Card>

      {problem && <p className="notice notice-error" role="alert">{problem}</p>}

      {isLoading ? (
        <p className="text-slate-600">Loading…</p>
      ) : isError ? (
        <p className="notice notice-error">The files could not be loaded. Try again.</p>
      ) : !all.length ? (
        <EmptyState title="No files yet" description="Files appear here when the SK Admin uploads them to a project." />
      ) : (
        <Card className="overflow-hidden">
          <div className="card-head flex flex-wrap items-center justify-between gap-2 px-5 py-3">
            <p className="text-sm text-slate-700" role="status">
              <span className="font-semibold text-ink">{shown.length}</span> of {all.length} files
            </p>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="sheet min-w-[58rem] w-full text-[14px]">
              <thead>
                <tr>
                  <th scope="col" className="w-12 text-right">No.</th>
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={c.right ? 'text-right' : ''}
                      >
                        <button type="button" className={`inline-flex items-center gap-1 ${active ? 'text-ink' : ''}`} onClick={() => sortBy(c.key)}>
                          {c.label}
                          <Icon size={13} strokeWidth={2} aria-hidden="true" className={active ? '' : 'opacity-50'} />
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col" className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length + 2} className="py-6 text-center text-slate-600">No files match these filters.</td>
                  </tr>
                ) : (
                  shown.map((f, i) => (
                    <tr key={f.id}>
                      <td className="text-right tabular text-slate-500">{i + 1}</td>
                      <td className="max-w-[16rem] break-words font-medium text-ink">{f.originalName}</td>
                      <td>{f.typeLabel}</td>
                      <td className="max-w-[14rem]">
                        <Link to={`/admin/projects/${f.project.id}`} className="font-medium text-pine hover:underline">
                          {f.project.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{f.statusText}</td>
                      <td>{f.uploadedByName || '—'}</td>
                      <td className="whitespace-nowrap">{formatDate(f.createdAt)}</td>
                      <td className="whitespace-nowrap text-right tabular">{f.amount == null ? '—' : formatPeso2(f.amount)}</td>
                      <td className="whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <button type="button" className="sheet-btn" onClick={() => open(f)} aria-label={`Open ${f.originalName}`} title="Open">
                            <ExternalLink size={15} aria-hidden="true" />
                          </button>
                          <button type="button" className="sheet-btn" onClick={() => save(f)} aria-label={`Download ${f.originalName}`} title="Download">
                            <Download size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
