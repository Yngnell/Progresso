const prisma = require('../prisma');
const { syncNotifications, sendPendingEmails } = require('../utils/notifications');
const { isMailConfigured, sendMail } = require('../utils/mailer');
const { issueCode, checkCode } = require('../utils/verification');

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
        include: {
          project: { select: { id: true, title: true, archivedAt: true } },
          event: { select: { id: true, title: true } },
        },
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
    verified: Boolean(req.user.notifyEmail && req.user.notifyEmailVerifiedAt),
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
    const changed = email !== (req.user.notifyEmail || '');
    const user = changed
      ? await prisma.user.update({
          where: { id: req.user.id },
          data: {
            notifyEmail: email || null,
            notifyEmailVerifiedAt: null, // a new address must be confirmed again
            ...(email ? {} : { verifyCodeHash: null, verifyCodeExpires: null, verifyCodeFor: null }),
          },
        })
      : req.user;

    // A new (or still unverified) address gets a 6-digit code to confirm it.
    let codeSent = false;
    let warning;
    if (email && !user.notifyEmailVerifiedAt && isMailConfigured()) {
      try {
        await issueCode(user, 'NOTIFY', email);
        codeSent = true;
      } catch (err) {
        if (err.status === 429) warning = err.message;
        else warning = 'We could not send the code. Check the address and try again.';
      }
    }
    res.json({
      email,
      verified: Boolean(email && user.notifyEmailVerifiedAt),
      codeSent,
      warning,
      mailConfigured: isMailConfigured(),
    });
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
    if (!req.user.notifyEmailVerifiedAt) {
      return res.status(400).json({ message: 'Verify your email address first (enter the 6-digit code)' });
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
        text: 'This is a test. Project alerts (progress milestones, projects about to end) and calendar reminders will be emailed to this address.',
        html: '<p style="font-family:Arial,sans-serif">This is a test. Project alerts (progress milestones, projects about to end) and calendar reminders will be emailed to this address.</p>',
      });
    } catch (err) {
      return res.status(502).json({ message: `The email could not be sent: ${err.message}` });
    }
    res.json({ message: `Test email sent to ${req.user.notifyEmail}` });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/verify-email — { code }. Confirms the saved alert address.
async function verifyNotifyEmail(req, res, next) {
  try {
    if (!req.user.notifyEmail) {
      return res.status(400).json({ message: 'Save your email address first' });
    }
    if (req.user.notifyEmailVerifiedAt) return res.json({ verified: true });
    await checkCode(req.user, 'NOTIFY', req.body.code);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { notifyEmailVerifiedAt: new Date() },
    });
    // Send any recent alerts that were waiting for a verified address.
    sendPendingEmails().catch((err) => console.error('Alert email failed:', err.message));
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/resend-code — sends a fresh code (at most one a minute).
async function resendNotifyCode(req, res, next) {
  try {
    if (!req.user.notifyEmail) {
      return res.status(400).json({ message: 'Save your email address first' });
    }
    if (req.user.notifyEmailVerifiedAt) return res.json({ verified: true });
    if (!isMailConfigured()) {
      return res.status(400).json({ message: 'Email is not set up on the server yet' });
    }
    try {
      await issueCode(req.user, 'NOTIFY', req.user.notifyEmail);
    } catch (err) {
      if (err.status === 429) return res.status(429).json({ message: err.message });
      return res.status(502).json({ message: 'We could not send the code. Try again later.' });
    }
    res.json({ codeSent: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyNotifyEmail,
  resendNotifyCode,
  listNotifications,
  markRead,
  markAllRead,
  getEmailSettings,
  saveEmailSettings,
  sendTestEmail,
};
