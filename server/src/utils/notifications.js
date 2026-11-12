const prisma = require('../prisma');
const { isMailConfigured, sendMail } = require('./mailer');

const HOUR = 60 * 60 * 1000;
// The stages where a project is being carried out (its schedule is running): ending-soon
// alerts watch these.
const RUNNING_STAGES = ['PURCHASING', 'FUND_RELEASE', 'IMPLEMENTATION', 'LIQUIDATION'];

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
  if (!RUNNING_STAGES.includes(project.status)) return [];
  const alerts = [];

  if (project.endDate) {
    const left = new Date(project.endDate).getTime() - now.getTime();
    if (left <= 0) {
      // Past the end date: no alert (there is no "overdue" state any more).
    } else if (left <= 24 * HOUR) {
      alerts.push({
        type: 'ENDING_1D',
        title: `Ending within a day: ${project.title}`,
        message: `${project.title} ends on ${when(project.endDate)}. Finish the required documents of its current stage.`,
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
    where: { archivedAt: null, status: { in: RUNNING_STAGES } },
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

// Emailed alerts: a meeting about to start, a running project about to end, and the
// decisions on a Project Request (submitted -> the chairman; approved or rejected -> the
// SK Admin). (Older kinds such as progress milestones stay in the bell.)
const REQUEST_TYPES = ['REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED'];
const EMAIL_TYPES = ['EVENT_1H', 'EVENT_1D', 'ENDING_1D', 'ENDING_3D', ...REQUEST_TYPES];

// Where an alert's button leads. The SK Admin opens the meeting or the project itself; the
// Barangay Chairman has no Meetings page, so a meeting alert opens the Dashboard (which lists
// the upcoming sessions) and a project alert opens the project.
function alertLink(a, role) {
  if (a.eventId) {
    return role === 'CHAIRMAN'
      ? { href: `${APP_URL()}/admin`, label: 'Open the dashboard' }
      : { href: `${APP_URL()}/admin/meetings/${a.eventId}`, label: 'Open the meeting' };
  }
  if (a.type === 'REQUEST_SUBMITTED') return { href: `${APP_URL()}/admin/projects/${a.projectId}`, label: 'Review the request' };
  return { href: `${APP_URL()}/admin/projects/${a.projectId}`, label: 'Open the project' };
}

// Small label shown above each alert's title.
const KIND = {
  EVENT_1H: { text: 'Meeting · starting soon', color: '#A9502C' },
  EVENT_1D: { text: 'Meeting · coming up', color: '#1F4D3A' },
  ENDING_1D: { text: 'Project · ends within a day', color: '#A9502C' },
  ENDING_3D: { text: 'Project · ending soon', color: '#8A5F12' },
  REQUEST_SUBMITTED: { text: 'Project Request · waiting for approval', color: '#8A5F12' },
  REQUEST_APPROVED: { text: 'Project Request · approved', color: '#1F4D3A' },
  REQUEST_REJECTED: { text: 'Project Request · rejected', color: '#A9502C' },
};

// Builds one email that lists every given alert, for one kind of account (role decides the
// links). Pure: no database or network. Styled like the system: warm paper, a cream card,
// pine buttons. Inline styles and table layout so every mail app shows it the same way.
function buildDigest(alerts, { role = 'ADMIN' } = {}) {
  const subject =
    alerts.length === 1 ? `SK Monitoring: ${alerts[0].title}` : `SK Monitoring: ${alerts.length} new alerts`;

  const text = [
    'SK Salinas 1 · Project Monitoring',
    '',
    ...alerts.map((a) => {
      const l = alertLink(a, role);
      return `${a.title}\n${a.message}\n${l.label}: ${l.href}`;
    }),
    '',
    'These alerts are sent to the email of your SK Monitoring account.',
  ].join('\n\n');

  const rows = alerts
    .map((a) => {
      const l = alertLink(a, role);
      const kind = KIND[a.type] || { text: a.eventId ? 'Meeting' : 'Project', color: '#1F4D3A' };
      return `
          <tr><td style="padding:0 0 12px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFDF8;border:1px solid #E2D9C8;border-radius:8px">
              <tr><td style="padding:18px 20px">
                <p style="margin:0 0 6px;font:600 12px Arial,Helvetica,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${kind.color}">${escapeHtml(kind.text)}</p>
                <p style="margin:0 0 6px;font:18px/1.35 Georgia,'Times New Roman',serif;color:#23211E">${escapeHtml(a.title)}</p>
                <p style="margin:0 0 14px;font:14px/1.55 Arial,Helvetica,sans-serif;color:#6B655C">${escapeHtml(a.message)}</p>
                <a href="${l.href}" style="display:inline-block;background:#1F4D3A;color:#ffffff;text-decoration:none;font:600 14px Arial,Helvetica,sans-serif;padding:10px 16px;border-radius:6px">${l.label}</a>
              </td></tr>
            </table>
          </td></tr>`;
    })
    .join('');

  const html = `
  <div style="background:#F6F1E7;padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
      <tr><td style="padding:0 4px 16px">
        <p style="margin:0;font:20px Georgia,'Times New Roman',serif;color:#23211E">SK Salinas 1</p>
        <p style="margin:2px 0 0;font:13px Arial,Helvetica,sans-serif;color:#6B655C">Project Monitoring · ${alerts.length === 1 ? 'an alert needs your attention' : `${alerts.length} alerts need your attention`}</p>
        <div style="width:40px;height:3px;background:#C8643B;border-radius:2px;margin-top:10px"></div>
      </td></tr>
      ${rows}
      <tr><td style="padding:8px 4px 0;font:12px/1.5 Arial,Helvetica,sans-serif;color:#6B655C">
        These alerts are sent to the email of your SK Monitoring account. You may need to log in before the page opens.
      </td></tr>
    </table>
  </div>`;

  return { subject, text, html };
}

// Alerts older than this are never emailed, so a delay never dumps old news into an inbox.
const EMAIL_WINDOW_MS = 6 * 60 * 60 * 1000;
let emailing = false;

// True while the meeting or project the alert is about is still ahead (a decision on a
// request is always news, unless the project was deleted).
function stillUpcoming(n, now) {
  if (n.event) return new Date(n.event.startAt) > now;
  if (n.project && REQUEST_TYPES.includes(n.type)) return !n.project.archivedAt;
  if (n.project) {
    return (
      RUNNING_STAGES.includes(n.project.status) &&
      !n.project.archivedAt &&
      Boolean(n.project.endDate) &&
      new Date(n.project.endDate) > now
    );
  }
  return false;
}

// Emails new alerts about upcoming meetings, projects ending soon and Project Request decisions
// to the registered email of every active SK Admin and Barangay Chairman account (one digest per
// account; an alert with an audience only goes to that role's accounts). Alerts that
// are of another kind or are no longer upcoming are marked as handled without being sent, so
// old news is never emailed. Alerts are marked only after sending; if the mail service fails
// they are retried on the next check. Does nothing until mail is set up.
async function sendPendingEmails() {
  if (emailing || !isMailConfigured()) return 0;
  emailing = true;
  try {
    const now = new Date();
    const pending = await prisma.notification.findMany({
      where: {
        emailedAt: null,
        OR: [{ audience: null }, { audience: { in: ['ADMIN', 'CHAIRMAN'] } }],
        createdAt: { gt: new Date(now.getTime() - EMAIL_WINDOW_MS) },
      },
      include: {
        event: { select: { startAt: true } },
        project: { select: { status: true, endDate: true, archivedAt: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (pending.length === 0) return 0;
    const toSend = pending.filter((n) => EMAIL_TYPES.includes(n.type) && stillUpcoming(n, now));

    if (toSend.length > 0) {
      const recipients = await prisma.user.findMany({
        where: { isActive: true, role: { in: ['ADMIN', 'CHAIRMAN'] } },
        select: { email: true, role: true },
      });
      const seen = new Set();
      const targets = recipients.filter((u) => {
        const e = (u.email || '').trim().toLowerCase();
        if (!e || seen.has(e)) return false;
        seen.add(e);
        return true;
      });
      if (targets.length === 0) return 0; // no accounts to send to: keep them for later
      for (const u of targets) {
        const mine = toSend.filter((a) => !a.audience || a.audience === u.role);
        if (mine.length === 0) continue;
        const { subject, text, html } = buildDigest(mine, { role: u.role });
        await sendMail({ to: u.email.trim(), subject, text, html });
      }
    }
    await prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data: { emailedAt: new Date() },
    });
    return toSend.length;
  } finally {
    emailing = false;
  }
}

// A bell alert (and email) about one project for one kind of account: audience 'CHAIRMAN'
// or 'ADMIN'. Replaces an older alert of the same type for the project, so the newest
// decision is the one shown and sent. The email goes out right away, without waiting.
async function notifyProject({ projectId, type, title, message, audience }) {
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { projectId, type } }),
    prisma.notification.create({ data: { projectId, type, title, message, audience } }),
  ]);
  sendPendingEmails().catch((err) => console.error('Alert email failed:', err.message));
}

module.exports = {
  evaluateProject,
  evaluateEvent,
  syncNotifications,
  buildDigest,
  sendPendingEmails,
  notifyProject,
  RUNNING_STAGES,
};
