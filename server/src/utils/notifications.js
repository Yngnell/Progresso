const prisma = require('../prisma');
const { isMailConfigured, sendMail } = require('./mailer');

const HOUR = 60 * 60 * 1000;

// Philippine date and time, e.g. "Oct 22, 2026, 5:00 PM".
function when(date) {
  return new Date(date).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Decides which alerts a project deserves right now. Pure: no database access.
// `project` has its status, title and scheduled end. Each alert is
// { type, title, message }; the unique (project, type) key in the database makes sure
// every alert is only ever created once.
function evaluateProject(project, now = new Date()) {
  if (project.status !== 'ONGOING') return [];
  const alerts = [];

  if (project.endDate) {
    const left = new Date(project.endDate).getTime() - now.getTime();
    if (left <= 0) {
      // Past the end date: no alert (there is no "overdue" state any more).
    } else if (left <= 24 * HOUR) {
      alerts.push({
        type: 'ENDING_1D',
        title: `Ending within a day: ${project.title}`,
        message: `${project.title} ends on ${when(project.endDate)}. Upload the receipt liquidation and finish the checklist before marking it as completed.`,
      });
    } else if (left <= 72 * HOUR) {
      const days = Math.ceil(left / (24 * HOUR));
      alerts.push({
        type: 'ENDING_3D',
        title: `Ending soon: ${project.title}`,
        message: `${project.title} ends in ${days} days (${when(project.endDate)}).`,
      });
    }
  }
  return alerts;
}

// Calendar reminders: one the day before and one the hour before an event starts.
// Pure. An event that is already under an hour away only gets the hour reminder, and
// past events get nothing, so a late start-up never floods the list.
function evaluateEvent(event, now = new Date()) {
  const left = new Date(event.startAt).getTime() - now.getTime();
  if (left <= 0) return [];
  const where = event.location ? ` at ${event.location}` : '';
  if (left <= HOUR) {
    return [
      {
        type: 'EVENT_1H',
        title: `Starting soon: ${event.title}`,
        message: `${event.title} starts at ${when(event.startAt)}${where}.`,
      },
    ];
  }
  if (left <= 24 * HOUR) {
    return [
      {
        type: 'EVENT_1D',
        title: `Coming up: ${event.title}`,
        message: `${event.title} is on ${when(event.startAt)}${where}.`,
      },
    ];
  }
  return [];
}

// Looks at every active project and upcoming event and creates the alerts that are newly due.
// Safe to run often: existing alerts are skipped by the unique key. Throttled so
// opening the notification list repeatedly does not hit the database each time.
let lastSync = 0;
async function syncNotifications({ force = false } = {}) {
  const now = new Date();
  if (!force && now.getTime() - lastSync < 30 * 1000) return 0;
  lastSync = now.getTime();
  // Overdue alerts were retired; clear any left from before.
  await prisma.notification.deleteMany({ where: { type: 'OVERDUE' } });

  const projects = await prisma.project.findMany({
    where: { archivedAt: null, status: 'ONGOING' },
    select: { id: true, title: true, status: true, endDate: true },
  });

  const rows = [];
  for (const p of projects) {
    for (const alert of evaluateProject(p, now)) {
      rows.push({ projectId: p.id, ...alert });
    }
  }

  // Events starting within the next day (plus a little slack)
  const events = await prisma.event.findMany({
    where: { startAt: { gt: now, lte: new Date(now.getTime() + 25 * HOUR) } },
    select: { id: true, title: true, startAt: true, location: true },
  });
  for (const e of events) {
    for (const alert of evaluateEvent(e, now)) rows.push({ eventId: e.id, ...alert });
  }

  let created = 0;
  if (rows.length > 0) {
    const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
    created = result.count;
  }

  // Email what is new, without making the caller wait for the mail server.
  sendPendingEmails().catch((err) => console.error('Alert email failed:', err.message));
  // Residents who opted in get their own, public-friendly email (loaded here to avoid a require cycle).
  require('./residentEmails')
    .sendPendingViewerEmails()
    .catch((err) => console.error('Resident email failed:', err.message));
  return created;
}

// ---------- Email ----------

const APP_URL = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

// Builds one email that lists every given alert. Pure: no database or network.
function buildDigest(alerts) {
  const link = (a) =>
    a.eventId ? `${APP_URL()}/admin/calendar/${a.eventId}` : `${APP_URL()}/admin/projects/${a.projectId}`;
  const subject =
    alerts.length === 1
      ? `SK Monitoring: ${alerts[0].title}`
      : `SK Monitoring: ${alerts.length} new alerts`;

  const text = alerts
    .map((a) => `${a.title}\n${a.message}\n${link(a)}`)
    .join('\n\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">
      <p style="font-size:16px;font-weight:bold;margin:0 0 12px">SK Project Monitoring: alerts</p>
      ${alerts
        .map(
          (a) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px">
          <p style="margin:0;font-weight:bold">${escapeHtml(a.title)}</p>
          <p style="margin:4px 0 8px;color:#475569;font-size:14px">${escapeHtml(a.message)}</p>
          <a href="${link(a)}" style="color:#4f46e5;font-size:14px">${a.eventId ? 'Open the event' : 'Open the project'}</a>
        </div>`
        )
        .join('')}
      <p style="color:#94a3b8;font-size:12px">These alerts are sent to the email of your SK Monitoring account.</p>
    </div>`;

  return { subject, text, html };
}

// Alerts older than this are never emailed (so turning email on later does not
// dump a long history into someone's inbox).
const EMAIL_WINDOW_MS = 48 * 60 * 60 * 1000;
let emailing = false;

// Emails every new alert, as one digest, to the registered email of every active SK Admin
// and Barangay Chairman account (no separate alert address to set up). An alert is marked
// as emailed only after it was sent; if the mail server fails it is retried on the next
// check. Does nothing until mail is set up.
async function sendPendingEmails() {
  if (emailing || !isMailConfigured()) return 0;
  emailing = true;
  try {
    const pending = await prisma.notification.findMany({
      where: {
        emailedAt: null,
        audience: null,
        createdAt: { gt: new Date(Date.now() - EMAIL_WINDOW_MS) },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) return 0;

    const recipients = await prisma.user.findMany({
      where: { isActive: true, role: { in: ['ADMIN', 'CHAIRMAN'] } },
      select: { email: true },
    });
    const addresses = [...new Set(recipients.map((u) => (u.email || '').trim().toLowerCase()).filter(Boolean))];
    if (addresses.length === 0) return 0; // no accounts to send to: keep them for later

    const { subject, text, html } = buildDigest(pending);
    for (const to of addresses) {
      await sendMail({ to, subject, text, html });
    }
    await prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data: { emailedAt: new Date() },
    });
    return pending.length;
  } finally {
    emailing = false;
  }
}

module.exports = { evaluateProject, evaluateEvent, syncNotifications, buildDigest, sendPendingEmails };
