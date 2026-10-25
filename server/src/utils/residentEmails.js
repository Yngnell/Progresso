const prisma = require('../prisma');
const { isMailConfigured, sendMail } = require('./mailer');

// Emails for residents who ticked "I would like to receive news and updates by email"
// when they signed up: project milestones, calendar reminders and new news articles.
// Wording is public-friendly and every link goes to the public site, never to the admin
// pages. Every email carries a "stop these emails" link.

const APP_URL = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESCAPES[c]);

// Alerts older than this are never emailed, so nobody gets a pile of old news.
const EMAIL_WINDOW_MS = 48 * 60 * 60 * 1000;
const PROGRESS_AT = { PROGRESS_50: 50, PROGRESS_75: 75, PROGRESS_90: 90 };

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

// One resident-facing item per alert: { title, message, link, linkText }.
// Returns null for alerts that must not go to the public (e.g. an archived project).
function publicLine(n) {
  if (n.event) {
    const where = n.event.location ? ` at ${n.event.location}` : '';
    return {
      title: n.type === 'EVENT_1H' ? `Starting soon: ${n.event.title}` : `Coming up: ${n.event.title}`,
      message: `${n.event.title} is on ${when(n.event.startAt)}${where}.`,
      link: `${APP_URL()}/events`,
      linkText: 'See the events',
    };
  }
  const p = n.project;
  if (!p || p.archivedAt || p.approvalState !== 'APPROVED') return null;
  const link = `${APP_URL()}/projects/${p.id}`;
  if (PROGRESS_AT[n.type]) {
    return {
      title: `${p.title} is ${PROGRESS_AT[n.type]}% done`,
      message: `${p.title} has reached ${PROGRESS_AT[n.type]}% of its progress.`,
      link,
      linkText: 'See the project',
    };
  }
  if (n.type === 'ENDING_3D' || n.type === 'ENDING_1D') {
    return {
      title: `${p.title} is wrapping up`,
      message: `${p.title} is scheduled to end on ${when(p.endDate)}.`,
      link,
      linkText: 'See the project',
    };
  }
  return null;
}

function unsubscribeLink(user) {
  return user.unsubscribeToken ? `${APP_URL()}/unsubscribe?token=${user.unsubscribeToken}` : null;
}

// Builds one email for a resident from a list of items. Pure: no database or network.
function buildPublicDigest(items, user) {
  const unsub = unsubscribeLink(user);
  const subject =
    items.length === 1 ? `SK Salinas 1: ${items[0].title}` : `SK Salinas 1: ${items.length} new updates`;
  const text =
    items.map((i) => `${i.title}\n${i.message}\n${i.link}`).join('\n\n') +
    (unsub ? `\n\nStop these emails: ${unsub}` : '');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:560px">
      <p style="font-size:16px;font-weight:bold;margin:0 0 12px">Sangguniang Kabataan, Barangay Salinas 1</p>
      ${items
        .map(
          (i) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px">
          <p style="margin:0;font-weight:bold">${escapeHtml(i.title)}</p>
          <p style="margin:4px 0 8px;color:#475569;font-size:14px">${escapeHtml(i.message)}</p>
          <a href="${i.link}" style="color:#1c66cc;font-size:14px">${escapeHtml(i.linkText || 'Read more')}</a>
        </div>`
        )
        .join('')}
      <p style="color:#94a3b8;font-size:12px">You get these emails because you chose to receive updates when you signed up.${
        unsub ? ` <a href="${unsub}" style="color:#94a3b8">Stop these emails</a>` : ''
      }</p>
    </div>`;
  return { subject, text, html };
}

// Residents who opted in, are verified and still active.
function subscribers() {
  return prisma.user.findMany({
    where: {
      role: 'VIEWER',
      isActive: true,
      receiveUpdates: true,
      emailVerifiedAt: { not: null },
      updatesSince: { not: null },
    },
    select: { id: true, email: true, updatesSince: true, unsubscribeToken: true },
  });
}

let emailing = false;

// Emails the new project and event alerts to residents. Each resident gets one email per
// run, and only about alerts created after they opted in.
async function sendPendingViewerEmails() {
  if (emailing || !isMailConfigured()) return 0;
  emailing = true;
  try {
    const pending = await prisma.notification.findMany({
      where: {
        viewerEmailedAt: null,
        createdAt: { gt: new Date(Date.now() - EMAIL_WINDOW_MS) },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        project: {
          select: { id: true, title: true, endDate: true, archivedAt: true, approvalState: true },
        },
        event: { select: { id: true, title: true, startAt: true, location: true } },
      },
    });
    if (pending.length === 0) return 0;

    let sent = 0;
    for (const user of await subscribers()) {
      const items = pending
        .filter((n) => new Date(n.createdAt) >= new Date(user.updatesSince))
        .map(publicLine)
        .filter(Boolean);
      if (items.length === 0) continue;
      try {
        const { subject, text, html } = buildPublicDigest(items, user);
        await sendMail({ to: user.email, subject, text, html });
        sent += 1;
      } catch (err) {
        console.error(`Resident email to ${user.email} failed:`, err.message);
      }
    }
    await prisma.notification.updateMany({
      where: { id: { in: pending.map((n) => n.id) } },
      data: { viewerEmailedAt: new Date() },
    });
    return sent;
  } finally {
    emailing = false;
  }
}

// Emails a newly published news article to the residents who opted in. Safe to call more
// than once: the article is claimed first, so it is only ever sent a single time.
async function sendNewsEmail(article) {
  if (!isMailConfigured() || article.status !== 'PUBLISHED') return 0;
  const claim = await prisma.news.updateMany({
    where: { id: article.id, emailedAt: null },
    data: { emailedAt: new Date() },
  });
  if (claim.count === 0) return 0;

  const item = {
    title: `New: ${article.title}`,
    message: article.excerpt || String(article.content || '').slice(0, 200),
    link: `${APP_URL()}/news/${article.id}`,
    linkText: 'Read the article',
  };
  let sent = 0;
  for (const user of await subscribers()) {
    try {
      const { subject, text, html } = buildPublicDigest([item], user);
      await sendMail({ to: user.email, subject, text, html });
      sent += 1;
    } catch (err) {
      console.error(`News email to ${user.email} failed:`, err.message);
    }
  }
  return sent;
}

module.exports = { publicLine, buildPublicDigest, sendPendingViewerEmails, sendNewsEmail };
