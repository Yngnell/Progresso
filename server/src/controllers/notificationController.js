const prisma = require('../prisma');
const { syncNotifications, sendPendingEmails } = require('../utils/notifications');
const { isMailConfigured, sendMail } = require('../utils/mailer');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/notifications — admin and chairman. Newest first, with a per-user read flag.
async function listNotifications(req, res, next) {
  try {
    await syncNotifications(); // throttled; keeps the list fresh without waiting for the timer

    const uid = req.user.id;
    const [rows, unread] = await Promise.all([
      prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { project: { select: { id: true, title: true, archivedAt: true } } },
      }),
      prisma.notification.count({ where: { NOT: { readByIds: { has: uid } } } }),
    ]);

    const notifications = rows.map(({ readByIds, ...n }) => ({
      ...n,
      read: readByIds.includes(uid),
    }));
    res.json({ notifications, unread });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const uid = req.user.id;
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    if (!n.readByIds.includes(uid)) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { readByIds: { push: uid } },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// PUT /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    const uid = req.user.id;
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "readByIds" = array_append("readByIds", ${uid})
      WHERE NOT (${uid} = ANY("readByIds"))`;
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/email-settings — where this person's alerts are emailed.
async function getEmailSettings(req, res) {
  res.json({
    email: req.user.notifyEmail || '',
    mailConfigured: isMailConfigured(),
  });
}

// PUT /api/notifications/email-settings — { email }. A blank email turns email alerts off.
async function saveEmailSettings(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (email && !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { notifyEmail: email || null },
    });
    // Send any recent alerts that were waiting for someone to opt in.
    if (email) sendPendingEmails().catch((err) => console.error('Alert email failed:', err.message));
    res.json({ email, mailConfigured: isMailConfigured() });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/test-email — sends a test message to the saved address.
async function sendTestEmail(req, res, next) {
  try {
    if (!req.user.notifyEmail) {
      return res.status(400).json({ message: 'Save your email address first' });
    }
    if (!isMailConfigured()) {
      return res.status(400).json({
        message:
          'Email is not set up on the server yet. Add MAIL_USER and MAIL_APP_PASSWORD to server/.env and restart the server.',
      });
    }
    try {
      await sendMail({
        to: req.user.notifyEmail,
        subject: 'SK Monitoring: test email',
        text: 'This is a test. Project alerts (progress milestones and projects about to end) will be emailed to this address.',
        html: '<p style="font-family:Arial,sans-serif">This is a test. Project alerts (progress milestones and projects about to end) will be emailed to this address.</p>',
      });
    } catch (err) {
      return res.status(502).json({ message: `The email could not be sent: ${err.message}` });
    }
    res.json({ message: `Test email sent to ${req.user.notifyEmail}` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
};
