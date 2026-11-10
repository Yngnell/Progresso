import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Maximize2, Power, Printer, QrCode, RefreshCw } from 'lucide-react';
import { attendanceApi, checkInLink } from '../api/attendance';
import { Badge, Button, Input, Modal } from './ui';
import { formatDateTime, formatTime, toDateTimeLocal } from '../utils/format';

const MIN = 60 * 1000;

// Where a QR code stands right now.
export function qrStatus(qr, now = Date.now()) {
  if (!qr) return { key: 'none', label: 'Not generated', tone: 'slate' };
  if (!qr.active) return { key: 'off', label: 'Deactivated', tone: 'red' };
  if (now < new Date(qr.validFrom).getTime()) return { key: 'soon', label: `Opens ${formatTime(qr.validFrom)}`, tone: 'blue' };
  if (now > new Date(qr.validUntil).getTime()) return { key: 'expired', label: 'Expired', tone: 'slate' };
  return { key: 'open', label: 'Open for scanning', tone: 'green' };
}

// "Generate Attendance QR" button for one calendar event. Only render it for the SK
// Chairperson (user.isSkChair); the server refuses everyone else too.
export function AttendanceQrButton({ event, size = 'sm', className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant="accent" className={className} onClick={() => setOpen(true)}>
        <QrCode size={16} strokeWidth={1.75} aria-hidden="true" />
        Generate Attendance QR
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Attendance QR" size="xl">
        {open && <AttendanceQrPanel eventId={event.id} />}
      </Modal>
    </>
  );
}

function windowError(from, until) {
  if (!from || !until) return 'Choose when the QR code opens and closes.';
  const a = new Date(from).getTime();
  const b = new Date(until).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 'Choose a valid date and time.';
  if (b - a < 10 * MIN) return 'The QR code must stay valid for at least 10 minutes.';
  return '';
}

// Everything the SK Chairperson does with one event's QR code.
export function AttendanceQrPanel({ eventId }) {
  const qc = useQueryClient();
  const key = ['attendance-qr', eventId];
  const { data, isLoading, error } = useQuery({ queryKey: key, queryFn: () => attendanceApi.qr(eventId) });
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(null);
  const canvasWrap = useRef(null);

  const qr = data?.qr;
  const event = data?.event;

  // Pre-fill the time fields from the saved window, or the defaults for a new code.
  useEffect(() => {
    if (!data) return;
    const w = data.qr || data.defaults;
    setFrom(toDateTimeLocal(w.validFrom));
    setUntil(toDateTimeLocal(w.validUntil));
  }, [data]);

  const save = useMutation({
    mutationFn: ({ action, body }) =>
      action === 'update' ? attendanceApi.updateQr(eventId, body) : attendanceApi.generateQr(eventId, body),
    onSuccess: (res, vars) => {
      qc.setQueryData(key, res);
      setEditing(false);
      setMsg({ ok: true, text: vars.okText });
    },
    onError: (err) => setMsg({ ok: false, text: err.response?.data?.message || 'The QR code could not be changed.' }),
  });

  if (isLoading) return <p className="text-sm text-slate-600">Loading…</p>;
  if (error) return <p className="text-red-700">{error.response?.data?.message || 'The QR code could not be loaded.'}</p>;

  const status = qrStatus(qr);
  const problem = windowError(from, until);
  const windowBody = () => ({ validFrom: new Date(from).toISOString(), validUntil: new Date(until).toISOString() });

  const timeFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label="Valid from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required />
      <Input label="Valid until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} required />
      <p className={`text-sm sm:col-span-2 ${problem ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
        {problem ||
          'At least 10 minutes. Every scan is recorded as Present; officials who have not scanned when the event ends are marked Absent.'}
      </p>
    </div>
  );

  function canvas() {
    return canvasWrap.current?.querySelector('canvas');
  }

  // A PNG with the event name under the code, ready to share or print.
  function downloadPng() {
    const src = canvas();
    if (!src) return;
    const pad = 40;
    const out = document.createElement('canvas');
    out.width = src.width + pad * 2;
    out.height = src.height + pad * 2 + 90;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(src, pad, pad);
    ctx.fillStyle = '#0A0C10';
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(event.title, out.width / 2, src.height + pad + 45, out.width - 20);
    ctx.font = '22px Arial, sans-serif';
    ctx.fillText(formatDateTime(event.startAt), out.width / 2, src.height + pad + 80, out.width - 20);
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = `attendance-qr-${event.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date(event.startAt).toISOString().slice(0, 10)}.png`;
    a.click();
  }

  function printQr() {
    const src = canvas();
    if (!src) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return setMsg({ ok: false, text: 'Allow pop-ups for this site to print the QR code.' });
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    w.document.write(`<!doctype html><html><head><title>Attendance QR - ${esc(event.title)}</title>
<style>body{font-family:Arial,sans-serif;text-align:center;margin:40px;color:#0A0C10}
h1{font-size:28px;margin:0 0 6px}p{margin:4px 0;font-size:16px}img{width:420px;height:420px;margin:24px auto;display:block}
.small{font-size:13px;color:#334055}</style></head><body>
<p class="small">Sangguniang Kabataan, Barangay Salinas 1</p>
<h1>${esc(event.title)}</h1><p>${esc(formatDateTime(event.startAt))}${event.location ? ' · ' + esc(event.location) : ''}</p>
<img src="${src.toDataURL('image/png')}" alt="Attendance QR code">
<p><strong>Scan with your phone camera to record your attendance.</strong></p>
<p class="small">Valid ${esc(formatDateTime(qr.validFrom))} to ${esc(formatDateTime(qr.validUntil))}</p>
<script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-900">{event.title}</p>
        <span className="text-slate-600">· {formatDateTime(event.startAt)}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
          role={msg.ok ? 'status' : 'alert'}
        >
          {msg.text}
        </p>
      )}

      {!qr ? (
        <div className="mt-4 space-y-4">
          <p className="text-slate-700">
            This event gets its own QR code. Officials scan it with their phone camera to record their attendance.
          </p>
          {timeFields}
          <Button
            variant="accent"
            disabled={Boolean(problem) || save.isPending}
            onClick={() => save.mutate({ action: 'generate', body: windowBody(), okText: 'The QR code is ready.' })}
          >
            <QrCode size={18} strokeWidth={1.75} aria-hidden="true" />
            {save.isPending ? 'Generating…' : 'Generate Attendance QR'}
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
          <div ref={canvasWrap} className={`mx-auto rounded-xl bg-white p-3 ring-1 ring-slate-200 ${qr.active ? '' : 'opacity-40'}`}>
            <QRCodeCanvas value={checkInLink(eventId, qr.token)} size={232} level="M" marginSize={2} aria-label="Attendance QR code" />
          </div>
          <div className="min-w-0 space-y-4">
            {editing ? (
              <div className="space-y-3">
                {timeFields}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    disabled={Boolean(problem) || save.isPending}
                    onClick={() => save.mutate({ action: 'update', body: windowBody(), okText: 'The valid time was changed.' })}
                  >
                    Save time
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-slate-600">Valid</p>
                <p className="text-slate-900">
                  {formatDateTime(qr.validFrom)} to {formatDateTime(qr.validUntil)}
                </p>
                <button
                  type="button"
                  className="mt-1 text-sm font-semibold text-brand-700 hover:text-brand-800"
                  onClick={() => setEditing(true)}
                >
                  Change how long it is valid
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Link to={`/attendance-qr/${eventId}`}>
                <Button variant="primary" disabled={!qr.active}>
                  <Maximize2 size={17} strokeWidth={1.75} aria-hidden="true" />
                  Full screen
                </Button>
              </Link>
              <Button variant="secondary" onClick={downloadPng} disabled={!qr.active}>
                <Download size={17} strokeWidth={1.75} aria-hidden="true" />
                Download PNG
              </Button>
              <Button variant="secondary" onClick={printQr} disabled={!qr.active}>
                <Printer size={17} strokeWidth={1.75} aria-hidden="true" />
                Print
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {qr.active ? (
                <Button
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => {
                    if (window.confirm('Deactivate this QR code? Scans will stop working until you activate it again.')) {
                      save.mutate({ action: 'update', body: { active: false }, okText: 'The QR code was deactivated.' });
                    }
                  }}
                >
                  <Power size={17} strokeWidth={1.75} aria-hidden="true" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ action: 'update', body: { active: true }, okText: 'The QR code is active again.' })}
                >
                  <Power size={17} strokeWidth={1.75} aria-hidden="true" />
                  Activate
                </Button>
              )}
              <Button
                variant="danger"
                disabled={save.isPending}
                onClick={() => {
                  if (window.confirm('Make a new QR code? The old one, including printed or downloaded copies, stops working.')) {
                    save.mutate({ action: 'generate', body: { regenerate: true }, okText: 'A new QR code was made. The old one no longer works.' });
                  }
                }}
              >
                <RefreshCw size={17} strokeWidth={1.75} aria-hidden="true" />
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
