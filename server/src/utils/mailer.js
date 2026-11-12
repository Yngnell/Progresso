const nodemailer = require('nodemailer');

// Sends the system's emails (alerts, verification codes, resident updates).
//
// Two ways to send, picked by the environment:
//   1. Brevo's web API (used on Railway, which blocks outgoing SMTP on its free/hobby plans)
//        BREVO_API_KEY      API key from Brevo (Settings → SMTP & API → API keys)
//        MAIL_FROM_EMAIL    the sender address verified in Brevo (falls back to MAIL_USER)
//   2. Gmail's SMTP server with an app password (handy on a local computer)
//        MAIL_USER          the Gmail address the emails are sent from
//        MAIL_APP_PASSWORD  a Google "app password" for that account (not the login password)
// Both use MAIL_FROM_NAME (optional display name, default "SK Monitoring").
// With neither set, the system skips email and keeps working with in-app notifications.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

let transport = null; // test override, or the Gmail SMTP transport once created

const senderEmail = () => process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER || '';
const senderName = () => process.env.MAIL_FROM_NAME || 'SK Monitoring';
const usesBrevo = () => !transport && Boolean(process.env.BREVO_API_KEY && senderEmail());

function isMailConfigured() {
  return Boolean(transport || usesBrevo() || (process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD));
}

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        // Google shows app passwords in groups of four letters; spaces are optional.
        pass: String(process.env.MAIL_APP_PASSWORD).replace(/\s+/g, ''),
      },
    });
  }
  return transport;
}

// Lets tests swap in a fake transport so nothing is really sent.
function setTransportForTests(fake) {
  transport = fake;
}

// One email through Brevo's transactional email API (plain HTTPS, so hosts that block
// SMTP still work). Returns the same shape nodemailer does for the callers that look.
async function sendWithBrevo({ to, subject, text, html }) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName(), email: senderEmail() },
      to: [{ email: to }],
      subject,
      htmlContent: html || undefined,
      textContent: text || undefined,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Brevo refused the email (${res.status}): ${body.message || body.code || 'unknown error'}`);
  }
  return { messageId: body.messageId, accepted: [to], rejected: [] };
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    const err = new Error('Email is not set up on the server yet');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  if (usesBrevo()) return sendWithBrevo({ to, subject, text, html });
  return getTransport().sendMail({
    from: `"${senderName()}" <${process.env.MAIL_USER || 'no-reply@sk-monitoring.local'}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { isMailConfigured, sendMail, setTransportForTests };
