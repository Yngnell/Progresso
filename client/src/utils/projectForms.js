// Auto-made project forms (PDF, SK letterhead), filled from what was already typed in the
// system: the Activity Design, Purchase Request, Request for Quotation, Abstract of Canvass,
// Purchase Order and Liquidation Report. Small value procurement path for SK projects:
// PR -> RFQ to at least 3 suppliers -> Abstract of Canvass (lowest wins) -> PO -> liquidation.
import {
  PDF_MARGIN as M,
  clean,
  fileStamp,
  letterhead,
  loadLogo,
  pageNumbers,
  pdfKit,
  peso,
  saveBlob,
  sectionTitle,
  table,
} from './reportExport';
import { formatDate, formatDateTime } from './format';

const MIN_QUOTATIONS = 3;

// Which forms can be made now, and what each still needs.
export function formReadiness(project) {
  const items = project.items || [];
  const quotations = project.quotations || [];
  const receipts = project.liquidationFiles || [];
  const noItems = 'Add the items to buy (Edit the project)';
  return [
    { key: 'activity', label: 'Activity Design', ready: true },
    { key: 'pr', label: 'Purchase Request', ready: items.length > 0, why: noItems },
    { key: 'rfq', label: 'Request for Quotation', ready: items.length > 0, why: noItems },
    {
      key: 'abstract',
      label: 'Abstract of Canvass',
      ready: items.length > 0 && quotations.filter((q) => q.complete).length >= MIN_QUOTATIONS,
      why: items.length ? `Needs ${MIN_QUOTATIONS} complete quotations` : noItems,
    },
    {
      key: 'po',
      label: 'Purchase Order',
      ready: Boolean(project.winningQuotationId),
      why: items.length ? 'Needs a quotation that prices every item' : noItems,
    },
    {
      key: 'liquidation',
      label: 'Liquidation Report',
      ready: receipts.length > 0 && project.receiptsWithoutAmount === 0,
      why: receipts.length ? 'Enter the amount of every receipt' : 'Upload the receipts first',
    },
  ];
}

// Officials who sign, found by position (as on the Project Request form).
function signatories(project, officials) {
  const find = (re) => officials.find((o) => re.test(o.position || ''));
  const person = (o, fallback) => ({ name: o?.name || '', position: o?.position || fallback });
  return {
    chair: person(find(/chairperson/i), 'SK Chairperson'),
    treasurer: person(find(/treasurer/i), 'SK Treasurer'),
    secretary: person(find(/secretary/i), 'SK Secretary'),
    punong: { name: project.reviewedBy?.name || '', position: 'Punong Barangay' },
  };
}

// A row of signature blocks: label, then a line with the name and the position below it.
function signatures(doc, y, blocks) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 45) {
    doc.addPage();
    y = M + 10;
  }
  const col = (W - M * 2) / blocks.length;
  blocks.forEach((b, i) => {
    const x = M + col * i;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(10, 12, 16);
    doc.text(clean(`${b.label}:`), x, y);
    doc.setDrawColor(10, 12, 16);
    doc.setLineWidth(0.3);
    doc.line(x, y + 16, x + col - 8, y + 16);
    doc.setFont('helvetica', 'bold');
    doc.text(clean((b.name || '').toUpperCase()), x + (col - 8) / 2, y + 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(clean(b.position || ''), x + (col - 8) / 2, y + 20, { align: 'center' });
  });
  return y + 28;
}

function paragraph(doc, text, y) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(34, 45, 64);
  const lines = doc.splitTextToSize(clean(text), W - M * 2);
  doc.text(lines, M, y);
  return y + lines.length * 5 + 3;
}

const amount = (n) => peso(n).replace('PHP ', '');
const lineTotal = (price, qty) => Math.round(Number(price) * qty * 100) / 100;

// Pesos in words for the Purchase Order, e.g. "One thousand two hundred pesos and 50/100".
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (r >= 20) parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ''));
  else if (r) parts.push(ONES[r]);
  return parts.join(' ');
}
export function pesoWords(value) {
  const n = Math.round(Number(value || 0) * 100);
  let whole = Math.floor(n / 100);
  const cents = n % 100;
  if (whole === 0) return `Zero pesos and ${String(cents).padStart(2, '0')}/100`;
  const groups = [];
  for (const unit of ['', ' thousand', ' million', ' billion']) {
    const g = whole % 1000;
    if (g) groups.unshift(below1000(g) + unit);
    whole = Math.floor(whole / 1000);
    if (!whole) break;
  }
  const words = groups.join(' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} pesos and ${String(cents).padStart(2, '0')}/100`;
}

async function startDoc(settings, orientation = 'portrait') {
  const [{ jsPDF, autoTable }, logo] = await Promise.all([pdfKit(), loadLogo(settings)]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
  return { doc, autoTable, logo };
}

function finish(doc, name, project) {
  pageNumbers(doc);
  const slug = String(project.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  saveBlob(doc.output('blob'), `${name}-${slug}-${fileStamp()}.pdf`);
}

const firstPr = (project) => (project.requestItems || [])[0] || {};
const schedule = (p) => (p.startDate && p.endDate ? `${formatDateTime(p.startDate)} to ${formatDateTime(p.endDate)}` : 'To be set');

function itemRows(items, priceOf = (i) => i.estUnitCost) {
  return items.map((i, n) => [
    String(n + 1),
    i.unit || '-',
    i.description,
    String(i.quantity),
    amount(priceOf(i)),
    amount(lineTotal(priceOf(i), i.quantity)),
  ]);
}
const ITEM_HEAD = ['No.', 'Unit', 'Item description', 'Qty', 'Unit cost', 'Amount'];
const ITEM_STYLE = {
  columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 16 }, 3: { cellWidth: 12, halign: 'right' }, 4: { cellWidth: 26, halign: 'right' }, 5: { cellWidth: 28, halign: 'right' } },
};
const totalRow = (label, value) => [{ content: label, colSpan: 5, styles: { fontStyle: 'bold' } }, { content: amount(value), styles: { fontStyle: 'bold', halign: 'right' } }];

// ---------------- the forms ----------------

async function activityDesign({ project, settings, officials }) {
  const { doc, autoTable, logo } = await startDoc(settings);
  const s = signatories(project, officials);
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Activity Design',
    details: [
      ['Project', project.title],
      ['Category', project.category || '-'],
      ['Venue', project.location || '-'],
      ['Schedule', schedule(project)],
      ['Budget', peso(project.budget)],
    ],
  });
  y = sectionTitle(doc, 'Rationale and objectives', y + 2);
  y = paragraph(doc, project.description || 'To be written.', y + 3);
  const items = project.items || [];
  if (items.length) {
    y = sectionTitle(doc, 'Budget breakdown', y);
    const total = items.reduce((sum, i) => sum + lineTotal(i.estUnitCost, i.quantity), 0);
    y = table(doc, autoTable, y, ITEM_HEAD, [...itemRows(items), totalRow('Total', total)], ITEM_STYLE);
  }
  if ((project.officials || []).length) {
    y = sectionTitle(doc, 'Persons in charge', y);
    y = table(doc, autoTable, y, ['Name', 'Position'], project.officials.map((o) => [o.name, o.position || '-']));
  }
  signatures(doc, y + 4, [
    { label: 'Prepared by', ...s.treasurer },
    { label: 'Noted by', ...s.chair },
    { label: 'Approved by', ...s.punong },
  ]);
  finish(doc, 'activity-design', project);
}

async function purchaseRequest({ project, settings, officials }) {
  const { doc, autoTable, logo } = await startDoc(settings);
  const s = signatories(project, officials);
  const pr = firstPr(project);
  const items = project.items || [];
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Purchase Request',
    details: [
      ['PR No.', pr.prNo || '-'],
      ['Date', pr.prDate ? formatDate(pr.prDate) : formatDate(new Date())],
      ['Project', project.title],
    ],
  });
  const total = items.reduce((sum, i) => sum + lineTotal(i.estUnitCost, i.quantity), 0);
  y = table(doc, autoTable, y + 2, ITEM_HEAD, [...itemRows(items), totalRow('Total estimated cost', total)], ITEM_STYLE);
  y = paragraph(doc, `Purpose: For the ${project.title}.`, y);
  signatures(doc, y + 4, [
    { label: 'Requested by', name: pr.requestedBy || s.treasurer.name, position: pr.requestedBy ? '' : s.treasurer.position },
    { label: 'Approved by', ...s.chair },
  ]);
  finish(doc, 'purchase-request', project);
}

async function requestForQuotation({ project, settings, officials }) {
  const { doc, autoTable, logo } = await startDoc(settings);
  const s = signatories(project, officials);
  const pr = firstPr(project);
  const items = project.items || [];
  // One page per supplier already listed in the canvass, or one blank page.
  const suppliers = (project.quotations || []).length ? project.quotations : [{ supplierName: '', supplierAddress: '' }];
  suppliers.forEach((q, n) => {
    if (n > 0) doc.addPage();
    let y = letterhead(doc, {
      logo,
      settings,
      title: 'Request for Quotation',
      details: [
        ['Supplier', q.supplierName || '______________________________'],
        ['Address', q.supplierAddress || '______________________________'],
        ['Date', formatDate(new Date())],
        ['PR No.', pr.prNo || '-'],
        ['Project', project.title],
      ],
    });
    y = paragraph(
      doc,
      'Please quote your lowest price on the items listed below, subject to the conditions stated, and submit your quotation duly signed by you or your representative.',
      y + 2
    );
    y = table(
      doc,
      autoTable,
      y,
      ['No.', 'Unit', 'Item description', 'Qty', 'Unit price', 'Amount'],
      items.map((i, k) => [String(k + 1), i.unit || '-', i.description, String(i.quantity), '', '']),
      { ...ITEM_STYLE, bodyStyles: { minCellHeight: 8 } }
    );
    y = signatures(doc, y + 4, [{ label: 'Requested by', ...s.chair }]);
    signatures(doc, y, [{ label: 'Quotation submitted by', name: '', position: "Supplier's signature over printed name" }]);
  });
  finish(doc, 'request-for-quotation', project);
}

async function abstractOfCanvass({ project, settings, officials }) {
  const quotations = (project.quotations || []).filter((q) => q.complete);
  const { doc, autoTable, logo } = await startDoc(settings, quotations.length > 3 ? 'landscape' : 'portrait');
  const s = signatories(project, officials);
  const pr = firstPr(project);
  const items = project.items || [];
  const winner = quotations.find((q) => q.id === project.winningQuotationId);
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Abstract of Canvass',
    details: [
      ['PR No.', pr.prNo || '-'],
      ['Date', formatDate(new Date())],
      ['Project', project.title],
      ['Mode', 'Small Value Procurement'],
    ],
  });
  const head = ['No.', 'Item description', 'Qty', ...quotations.map((q) => q.supplierName)];
  const body = items.map((i, k) => [
    String(k + 1),
    `${i.description}${i.unit ? ` (${i.unit})` : ''}`,
    String(i.quantity),
    ...quotations.map((q) => `${amount(q.prices[i.id])} / ${amount(lineTotal(q.prices[i.id], i.quantity))}`),
  ]);
  body.push([
    { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold' } },
    ...quotations.map((q) => ({
      content: amount(q.total),
      styles: { fontStyle: 'bold', halign: 'right', fillColor: q.id === winner?.id ? [220, 237, 224] : undefined },
    })),
  ]);
  y = table(doc, autoTable, y + 2, head, body, {
    columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 12, halign: 'right' } },
  });
  y = paragraph(doc, 'Prices are shown as unit price / amount.', y - 4);
  if (winner) {
    y = paragraph(
      doc,
      `Lowest calculated quotation: ${winner.supplierName}, ${peso(winner.total)}. Recommended for award to ${winner.supplierName}.`,
      y + 2
    );
  }
  signatures(doc, y + 4, [
    { label: 'Canvassed by', ...s.secretary },
    { label: 'Checked by', ...s.treasurer },
    { label: 'Approved by', ...s.chair },
  ]);
  finish(doc, 'abstract-of-canvass', project);
}

async function purchaseOrder({ project, settings, officials }) {
  const { doc, autoTable, logo } = await startDoc(settings);
  const s = signatories(project, officials);
  const pr = firstPr(project);
  const items = project.items || [];
  const winner = (project.quotations || []).find((q) => q.id === project.winningQuotationId);
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Purchase Order',
    details: [
      ['Supplier', winner.supplierName],
      ['Address', winner.supplierAddress || '-'],
      ['PO No.', '______________'],
      ['Date', formatDate(new Date())],
      ['PR No.', pr.prNo || '-'],
      ['Mode', 'Small Value Procurement'],
      ['Place of delivery', project.location || '-'],
    ],
  });
  y = paragraph(doc, 'Please deliver the following items to this office subject to the terms and conditions herein:', y + 2);
  y = table(
    doc,
    autoTable,
    y,
    ITEM_HEAD,
    [...itemRows(items, (i) => winner.prices[i.id]), totalRow('Total amount', winner.total)],
    ITEM_STYLE
  );
  y = paragraph(doc, `Total amount in words: ${pesoWords(winner.total)}.`, y);
  y = signatures(doc, y + 4, [
    { label: 'Conforme', name: '', position: `${winner.supplierName} (signature over printed name)` },
    { label: 'Approved by', ...s.chair },
  ]);
  signatures(doc, y, [{ label: 'Funds available', ...s.treasurer }]);
  finish(doc, 'purchase-order', project);
}

async function liquidationReport({ project, settings, officials }) {
  const { doc, autoTable, logo } = await startDoc(settings);
  const s = signatories(project, officials);
  const receipts = project.liquidationFiles || [];
  let y = letterhead(doc, {
    logo,
    settings,
    title: 'Liquidation Report',
    details: [
      ['Project', project.title],
      ['Period', schedule(project)],
      ['Date', formatDate(new Date())],
    ],
  });
  const body = receipts.map((r, k) => [
    String(k + 1),
    r.receiptDate ? formatDate(r.receiptDate) : '-',
    r.storeName || '-',
    r.originalName,
    amount(r.amount),
  ]);
  const sumRow = (label, v) => [{ content: label, colSpan: 4, styles: { fontStyle: 'bold' } }, { content: amount(v), styles: { fontStyle: 'bold', halign: 'right' } }];
  body.push(sumRow('Total amount spent', project.amountSpent));
  body.push(sumRow('Amount received (budget)', project.budget));
  body.push(sumRow(project.amountToRefund >= 0 ? 'Amount to be refunded' : 'Amount spent over the budget', Math.abs(project.amountToRefund)));
  y = table(doc, autoTable, y + 2, ['No.', 'Receipt date', 'Store / supplier', 'Receipt file', 'Amount'], body, {
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 26 }, 4: { cellWidth: 28, halign: 'right' } },
  });
  signatures(doc, y + 4, [
    { label: 'Submitted by', ...s.treasurer },
    { label: 'Certified correct', ...s.chair },
  ]);
  finish(doc, 'liquidation-report', project);
}

const MAKERS = {
  activity: activityDesign,
  pr: purchaseRequest,
  rfq: requestForQuotation,
  abstract: abstractOfCanvass,
  po: purchaseOrder,
  liquidation: liquidationReport,
};

// Makes one form and downloads it. args: { project, settings, officials }.
export async function makeProjectForm(key, args) {
  await MAKERS[key]({ ...args, officials: args.officials || [] });
}
