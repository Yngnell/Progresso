// PDF and Excel exports of the Dashboard and Attendance reports.
// The libraries are loaded only when someone exports, so normal pages stay light.
import { settingsApi } from '../api/settings';
import { PROJECT_STATUS, formatDate, formatDateTime, formatTime } from './format';
import { roleLabel } from './roles';

// jsPDF's built-in fonts only know Latin-1: swap the special spaces and dashes the
// browser puts in dates ("9:05 AM" uses a narrow space) for plain ones.
const clean = (v) =>
  String(v ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

const STATUS = { PRESENT: 'Present', ABSENT: 'Absent' };
const pct = (v) => (v == null ? '-' : `${v}%`);

export function rangeText(from, to) {
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return 'All dates';
}

function fileStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// The SK logo as a data URL (the uploaded one, or the SK seal).
async function loadLogo(settings) {
  try {
    const res = await fetch(settingsApi.logoUrl(settings));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const format = blob.type.includes('png') ? 'PNG' : blob.type.includes('webp') ? 'WEBP' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

async function pdfKit() {
  const [{ jsPDF }, plugin] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable: plugin.autoTable || plugin.default };
}

const M = 15; // page margin in mm

// Letterhead: logo, SK name, barangay, term, then the report title and its details.
function letterhead(doc, { logo, settings, title, details }) {
  const W = doc.internal.pageSize.getWidth();
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, logo.format, M, 10, 24, 24);
    } catch {
      /* an unreadable logo is left out */
    }
  }
  doc.setTextColor(10, 12, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Republic of the Philippines', W / 2, 14, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SANGGUNIANG KABATAAN', W / 2, 20.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(clean(settings.barangayName), W / 2, 26.5, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(51, 64, 85);
  doc.text(clean(`SK Term ${settings.skTerm}`), W / 2, 31.5, { align: 'center' });
  doc.setDrawColor(11, 31, 74);
  doc.setLineWidth(0.6);
  doc.line(M, 37, W - M, 37);

  doc.setTextColor(10, 12, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(clean(title), W / 2, 46, { align: 'center' });
  doc.setFontSize(9.5);
  let y = 54;
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(clean(`${label}:`), M, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(clean(value), W - M * 2 - 32);
    doc.text(lines, M + 32, y);
    y += 5 * lines.length;
  });
  return y + 3;
}

function sectionTitle(doc, text, y) {
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 40) {
    doc.addPage();
    y = M + 5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(10, 12, 16);
  doc.text(clean(text), M, y);
  return y + 3;
}

function table(doc, autoTable, y, head, body, opts = {}) {
  autoTable(doc, {
    startY: y,
    head: [head.map(clean)],
    body: body.map((row) => row.map(clean)),
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: [34, 45, 64], lineColor: [216, 224, 238] },
    headStyles: { fillColor: [11, 31, 74], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    ...opts,
  });
  return doc.lastAutoTable.finalY + 8;
}

function pageNumbers(doc) {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(98, 114, 144);
    doc.text('SK Project Monitoring System', M, H - 8);
    doc.text(`Page ${i} of ${n}`, W - M, H - 8, { align: 'right' });
  }
}

const generatedBy = (user) => `${user?.name || ''} (${roleLabel(user)})`;

// ---------------- Dashboard ----------------

const PROJECT_ROWS = ['Draft', 'Pending', 'For Revision', 'Approved', 'Ongoing', 'Completed', 'Rejected', 'Cancelled'];

const peso = (n) =>
  `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PROJECT_STATUS_LABEL = Object.fromEntries(Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label]));
const slug = (t) =>
  String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

// The header lines of a dashboard export: the project ("All Projects" or the chosen one),
// the dates, when it was exported and by whom.
function dashboardDetails(report, user) {
  const { from, to } = report.range;
  return [
    ['Project', report.project ? report.project.title : 'All Projects'],
    ['Date range', rangeText(from, to)],
    ['Export date', formatDateTime(new Date())],
    ['Generated by', generatedBy(user)],
  ];
}

// The chosen project's own figures.
function projectRows(p) {
  const timeline = p.startDate
    ? `${formatDate(p.startDate)} to ${p.endDate ? formatDate(p.endDate) : '-'}`
    : '-';
  return [
    ['Project', p.title],
    ['ABYIP item', p.abyipItem || '-'],
    ['Status', PROJECT_STATUS_LABEL[p.status] || p.status],
    ['Progress', `${p.progress || 0}%`],
    ['Expenses recorded', String(p.expenseCount || 0)],
    ['Files', String(p.fileCount || 0)],
    ['Dates', timeline],
    ['Venue', p.location || '-'],
    ['Approved cost', peso(p.budget)],
    ['Total expenses', peso(p.totalSpent)],
    ['Remaining Budget', peso(p.remainingBudget)],
  ];
}

// Overall Budget (or the chosen project's Remaining Budget), as on the Dashboard.
function budgetRows(report) {
  const b = report.budget || { totalBudget: 0, totalSpent: 0, remaining: 0 };
  return [
    [report.project ? 'Approved cost' : `SK budget ${b.year || ''}`.trim(), peso(b.totalBudget)],
    ['Total expenses', peso(b.totalSpent)],
    [report.project ? 'Remaining Budget' : 'Overall Budget', peso(b.remaining)],
  ];
}

const dashboardFile = (report, ext) =>
  `dashboard-report-${report.project ? `${slug(report.project.title)}-` : ''}${fileStamp()}.${ext}`;

// chartNodes: the Dashboard chart panels, captured as pictures for the PDF.
export async function exportDashboardPdf({ report, settings, user, chartNodes = [] }) {
  const [{ jsPDF, autoTable }, logo, { toPng }] = await Promise.all([pdfKit(), loadLogo(settings), import('html-to-image')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = letterhead(doc, {
    logo,
    settings,
    title: report.project ? 'Project Analytics Report' : 'Dashboard Analytics Report',
    details: dashboardDetails(report, user),
  });

  if (report.project) {
    y = sectionTitle(doc, 'Project summary', y);
    y = table(doc, autoTable, y, ['Item', 'Details'], projectRows(report.project), {
      columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
    });
  }

  y = sectionTitle(doc, report.project ? 'Remaining Budget' : 'Overall Budget', y);
  y = table(doc, autoTable, y, ['Item', 'Amount'], budgetRows(report), {
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', cellWidth: 50 } },
  });

  const p = report.projects;
  y = sectionTitle(doc, 'Projects per status', y);
  y = table(doc, autoTable, y, ['Status', 'Projects'], [
    ...PROJECT_ROWS.map((k) => [k, String(p.byStatus[k])]),
    ['Total', String(p.total)],
  ], { columnStyles: { 1: { halign: 'right', cellWidth: 40 } } });

  // Charts, two per row.
  if (chartNodes.length) {
    y = sectionTitle(doc, 'Dashboard charts', y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(98, 114, 144);
    doc.text(clean(`As shown on the Dashboard on ${formatDate(new Date())}.`), M, y + 2);
    y += 6;
    const colW = (W - M * 2 - 6) / 2;
    let col = 0;
    let rowH = 0;
    for (const node of chartNodes) {
      const dataUrl = await toPng(node, { backgroundColor: '#ffffff', pixelRatio: 2, cacheBust: true });
      const img = await new Promise((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.src = dataUrl;
      });
      const h = (img.height / img.width) * colW;
      if (col === 0 && y + h > H - 20) {
        doc.addPage();
        y = M;
      }
      doc.addImage(dataUrl, 'PNG', M + col * (colW + 6), y, colW, h);
      rowH = Math.max(rowH, h);
      col += 1;
      if (col === 2) {
        y += rowH + 6;
        col = 0;
        rowH = 0;
      }
    }
    if (col !== 0) y += rowH + 6;
    y += 2;
  }

  const att = report.attendance;
  y = sectionTitle(doc, 'Attendance per event', y);
  y = table(
    doc,
    autoTable,
    y,
    ['Event', 'Date', 'Present', 'Absent', 'Rate'],
    att.perEvent.length
      ? att.perEvent.map((e) => [e.title, formatDateTime(e.startAt), e.present, e.absent, e.held ? pct(e.rate) : 'Upcoming'].map(String))
      : [['No events in this date range.', '', '', '', '']],
    { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } }
  );

  y = sectionTitle(doc, 'Attendance per official', y);
  y = table(
    doc,
    autoTable,
    y,
    ['Official', 'Position', 'Present', 'Absent', 'Rate'],
    att.perOfficial.length
      ? att.perOfficial.map((o) => [o.name, o.position || '-', o.present, o.absent, pct(o.rate)].map(String))
      : [['No attendance in this date range.', '', '', '', '']],
    { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } }
  );

  y = sectionTitle(doc, 'Events within the date range', y);
  table(
    doc,
    autoTable,
    y,
    ['Event', 'Type', 'Start', 'End', 'Location'],
    report.events.length
      ? report.events.map((e) => [e.title, typeLabel(e.type), formatDateTime(e.startAt), e.endAt ? formatDateTime(e.endAt) : '-', e.location || '-'])
      : [['No events in this date range.', '', '', '', '']]
  );

  pageNumbers(doc);
  doc.save(dashboardFile(report, 'pdf'));
}

const typeLabel = (t) => ({ MEETING: 'Meeting', SESSION: 'Session', ACTIVITY: 'Activity', APPOINTMENT: 'Appointment' })[t] || t;

// A sheet with the report heading on top and one table under it.
function addSheet(wb, name, { settings, title, details, head, rows, widths }) {
  const ws = wb.addWorksheet(name);
  ws.addRow(['SANGGUNIANG KABATAAN']).font = { bold: true, size: 13 };
  ws.addRow([settings.barangayName]);
  ws.addRow([`SK Term ${settings.skTerm}`]);
  ws.addRow([]);
  ws.addRow([title]).font = { bold: true, size: 12 };
  details.forEach(([k, v]) => {
    const r = ws.addRow([`${k}:`, v]);
    r.getCell(1).font = { bold: true };
  });
  ws.addRow([]);
  const h = ws.addRow(head);
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F4A' } };
    c.border = { bottom: { style: 'thin' } };
  });
  rows.forEach((r) => ws.addRow(r));
  ws.columns.forEach((col, i) => {
    col.width = widths?.[i] || 16;
  });
  return ws;
}

async function excelBook() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SK Project Monitoring System';
  wb.created = new Date();
  return wb;
}

async function saveBook(wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}

export async function exportDashboardExcel({ report, settings, user }) {
  const wb = await excelBook();
  const base = {
    settings,
    title: report.project ? 'Project Analytics Report' : 'Dashboard Analytics Report',
    details: dashboardDetails(report, user).map(([k, v]) => [k, clean(v)]),
  };
  if (report.project) {
    addSheet(wb, 'Project Summary', {
      ...base,
      head: ['Item', 'Details'],
      rows: projectRows(report.project).map(([k, v]) => [k, clean(v)]),
      widths: [18, 48],
    });
  }
  addSheet(wb, report.project ? 'Remaining Budget' : 'Overall Budget', {
    ...base,
    head: ['Item', 'Amount'],
    rows: budgetRows(report),
    widths: [24, 22],
  });
  const p = report.projects;
  addSheet(wb, 'Projects by Status', {
    ...base,
    head: ['Status', 'Projects'],
    rows: [...PROJECT_ROWS.map((k) => [k, p.byStatus[k]]), ['Total', p.total]],
    widths: [24, 14],
  });
  const att = report.attendance;
  addSheet(wb, 'Attendance per Event', {
    ...base,
    head: ['Event', 'Date', 'Present', 'Absent', 'Rate (%)'],
    rows: att.perEvent.map((e) => [e.title, clean(formatDateTime(e.startAt)), e.present, e.absent, e.held ? e.rate ?? '' : 'Upcoming']),
    widths: [32, 24, 10, 10, 10],
  });
  addSheet(wb, 'Attendance per Official', {
    ...base,
    head: ['Official', 'Position', 'Present', 'Absent', 'Rate (%)'],
    rows: att.perOfficial.map((o) => [o.name, o.position, o.present, o.absent, o.rate ?? '']),
    widths: [28, 20, 10, 10, 10],
  });
  addSheet(wb, 'Events', {
    ...base,
    head: ['Event', 'Type', 'Start', 'End', 'Location'],
    rows: report.events.map((e) => [e.title, typeLabel(e.type), clean(formatDateTime(e.startAt)), e.endAt ? clean(formatDateTime(e.endAt)) : '', e.location || '']),
    widths: [32, 14, 24, 24, 28],
  });
  await saveBook(wb, dashboardFile(report, 'xlsx'));
}

// ---------------- Attendance ----------------

const ATT_HEAD = ['Official Name', 'Position', 'Event Name', 'Event Date', 'Status', 'Time Checked In'];
const attRow = (r) => [
  r.officialName,
  r.position || '-',
  r.eventName,
  clean(formatDate(r.eventDate)),
  STATUS[r.status] || r.status,
  r.status === 'PRESENT' && r.timeIn ? clean(formatTime(r.timeIn)) : '',
];

// Name of whoever holds a position, for the signature lines.
const holder = (officials, re) => officials.find((o) => re.test(o.position || ''))?.name || '';

export async function exportAttendancePdf({ data, settings, user, filters }) {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([pdfKit(), loadLogo(settings)]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Attendance Report',
    details: [
      ['Filters used', filters],
      ['Date generated', formatDateTime(new Date())],
      ['Generated by', generatedBy(user)],
    ],
  });

  y = table(doc, autoTable, y, ATT_HEAD, data.rows.length ? data.rows.map(attRow) : [['No attendance matches these filters.', '', '', '', '', '']]);

  const t = data.summary.totals;
  y = sectionTitle(doc, 'Summary', y);
  y = table(doc, autoTable, y, ['Total Present', 'Total Absent', 'Attendance rate'], [
    [t.present, t.absent, pct(t.rate)].map(String),
  ]);
  y = sectionTitle(doc, 'Attendance rate per official', y);
  y = table(
    doc,
    autoTable,
    y,
    ['Official', 'Position', 'Present', 'Absent', 'Attendance rate'],
    data.summary.perOfficial.map((o) => [o.name, o.position || '-', o.present, o.absent, pct(o.rate)].map(String)),
    { columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } } }
  );
  doc.setFontSize(8.5);
  doc.setTextColor(98, 114, 144);
  doc.text('Attendance rate = Present / (Present + Absent). Absent: the official had not scanned the QR code when the event ended.', M, y - 4);

  // Signature lines
  if (y > H - 45) {
    doc.addPage();
    y = M + 10;
  }
  y += 10;
  const officials = data.officials || [];
  const blocks = [
    { label: 'Prepared by:', name: holder(officials, /secretary/i), role: 'SK Secretary', x: M },
    { label: 'Noted by:', name: holder(officials, /chair/i), role: 'SK Chairman', x: W / 2 + 10 },
  ];
  blocks.forEach((b) => {
    doc.setTextColor(10, 12, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(b.label, b.x, y);
    doc.setFont('helvetica', 'bold');
    if (b.name) doc.text(clean(b.name.toUpperCase()), b.x + 35, y + 13, { align: 'center' });
    doc.setLineWidth(0.3);
    doc.setDrawColor(10, 12, 16);
    doc.line(b.x, y + 15, b.x + 70, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(b.role, b.x + 35, y + 20, { align: 'center' });
  });

  pageNumbers(doc);
  doc.save(`attendance-report-${fileStamp()}.pdf`);
}

export async function exportAttendanceExcel({ data, settings, user, filters }) {
  const wb = await excelBook();
  const base = {
    settings,
    title: 'Attendance Report',
    details: [
      ['Filters used', filters],
      ['Date generated', clean(formatDateTime(new Date()))],
      ['Generated by', generatedBy(user)],
    ],
  };
  addSheet(wb, 'Attendance', { ...base, head: ATT_HEAD, rows: data.rows.map(attRow), widths: [26, 18, 30, 16, 12, 16] });
  const t = data.summary.totals;
  const ws = addSheet(wb, 'Summary', {
    ...base,
    head: ['Official', 'Position', 'Present', 'Absent', 'Attendance rate (%)'],
    rows: data.summary.perOfficial.map((o) => [o.name, o.position, o.present, o.absent, o.rate ?? '']),
    widths: [26, 18, 10, 10, 18],
  });
  ws.addRow([]);
  const totals = ws.addRow(['Total', '', t.present, t.absent, t.rate ?? '']);
  totals.font = { bold: true };
  await saveBook(wb, `attendance-report-${fileStamp()}.xlsx`);
}

// ---------------- Archives ----------------

const ARCHIVE_TITLE = {
  completed: 'Completed Projects',
  rejected: 'Rejected Project Requests',
  cancelled: 'Cancelled Projects',
  deleted: 'Deleted Projects',
};

const scheduleText = (p) =>
  p.startDate && p.endDate ? `${formatDate(p.startDate)} - ${formatDate(p.endDate)}` : 'Not set';

// The table for one Archives tab: the same records the page shows.
function archiveTable(tab, projects) {
  if (tab === 'deleted') {
    return {
      head: ['No.', 'Project', 'Status when deleted', 'Budget', 'Deleted on', 'Reason', 'Requested by', 'Approved by'],
      rows: projects.map((p, i) => [
        String(i + 1),
        p.title,
        PROJECT_STATUS_LABEL[p.status] || p.status,
        peso(p.estimatedCost ?? p.budget),
        formatDate(p.archivedAt),
        p.archivedReason || '-',
        p.deletionRequests?.[0]?.requestedByName || '-',
        p.archivedByName || '-',
      ]),
      widths: [6, 28, 16, 14, 14, 30, 20, 20],
    };
  }
  const when = (p) =>
    ({ completed: p.completedAt, rejected: p.reviewedAt, cancelled: p.cancelDate || p.cancelledAt })[tab] || p.updatedAt;
  const note = (p) =>
    ({ completed: p.accomplishmentSummary, rejected: p.reviewRemarks, cancelled: p.cancelReason })[tab] || '-';
  const cost = (p) => (tab === 'completed' ? p.amountSpent ?? p.budget : p.estimatedCost ?? p.budget);
  return {
    head: ['No.', 'Project', 'Status', 'Dates', tab === 'completed' ? 'Actual cost' : 'Cost', { completed: 'Completed on', rejected: 'Rejected on', cancelled: 'Cancelled on' }[tab] || 'Date', tab === 'completed' ? 'Accomplishment' : 'Reason / remarks'],
    rows: projects.map((p, i) => [
      String(i + 1),
      p.title,
      PROJECT_STATUS_LABEL[p.status] || p.status,
      scheduleText(p),
      peso(cost(p)),
      formatDate(when(p)),
      note(p),
    ]),
    widths: [6, 30, 12, 36, 14, 16, 30],
  };
}

function archiveDetails(tab, projects, user) {
  return [
    ['System', 'SK Project Monitoring System'],
    ['Archives tab', ARCHIVE_TITLE[tab]],
    ['Records', String(projects.length)],
    ['Date generated', formatDateTime(new Date())],
    ['Generated by', generatedBy(user)],
  ];
}

export async function exportArchivePdf({ tab, projects, settings, user }) {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([pdfKit(), loadLogo(settings)]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let y = letterhead(doc, {
    logo,
    settings,
    title: `Archives: ${ARCHIVE_TITLE[tab]}`,
    details: archiveDetails(tab, projects, user),
  });
  const t = archiveTable(tab, projects);
  table(doc, autoTable, y, t.head, t.rows.length ? t.rows : [['', 'No records in this tab.', ...t.head.slice(2).map(() => '')]]);
  pageNumbers(doc);
  doc.save(`archives-${tab}-${fileStamp()}.pdf`);
}

export async function exportArchiveExcel({ tab, projects, settings, user }) {
  const wb = await excelBook();
  const t = archiveTable(tab, projects);
  addSheet(wb, ARCHIVE_TITLE[tab].slice(0, 31), {
    settings,
    title: `Archives: ${ARCHIVE_TITLE[tab]}`,
    details: archiveDetails(tab, projects, user).map(([k, v]) => [k, clean(v)]),
    head: t.head,
    rows: t.rows.map((r) => r.map(clean)),
    widths: t.widths,
  });
  await saveBook(wb, `archives-${tab}-${fileStamp()}.xlsx`);
}
