const nodemailer = require('nodemailer');

// Sends mail through Gmail's SMTP server using an app password:
//   MAIL_USER          the Gmail address the alerts are sent from
//   MAIL_APP_PASSWORD  a Google "app password" for that account (not the login password)
//   MAIL_FROM_NAME     optional display name, default "SK Monitoring"
// Without MAIL_USER and MAIL_APP_PASSWORD the system simply skips email and keeps
// working with in-app notifications.

let transport = null;

function isMailConfigured() {
  return Boolean(transport || (process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD));
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

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    const err = new Error('Email is not set up on the server yet');
    err.code = 'MAIL_NOT_CONFIGURED';
    throw err;
  }
  const name = process.env.MAIL_FROM_NAME || 'SK Monitoring';
  return getTransport().sendMail({
    from: `"${name}" <${process.env.MAIL_USER || 'no-reply@sk-monitoring.local'}>`,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { isMailConfigured, sendMail, setTransportForTests };
