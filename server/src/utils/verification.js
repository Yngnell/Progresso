const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prisma');
const { sendMail } = require('./mailer');

// Email verification with a 6-digit code. One pending code per user. The purpose says
// which address it confirms: LOGIN (the account email, used at sign-up) or NOTIFY (the
// address that receives alerts).
const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const newCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

function tooSoon(sentAt) {
  return sentAt && Date.now() - new Date(sentAt).getTime() < RESEND_AFTER_MS;
}

async function mailCode(code, address) {
  const text =
    `Your SK Monitoring verification code is ${code}.\n` +
    'It expires in 15 minutes. If you did not ask for it, you can ignore this email.';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:480px">
      <p style="font-size:16px;font-weight:bold;margin:0 0 12px">SK Project Monitoring: verify your email</p>
      <p style="margin:0 0 8px">Your verification code is</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:0 0 12px">${code}</p>
      <p style="color:#475569;font-size:14px;margin:0">It expires in 15 minutes. If you did not ask for it, you can ignore this email.</p>
    </div>`;
  await sendMail({ to: address, subject: 'SK Monitoring: your verification code', text, html });
}

// Creates a fresh code for the user and emails it to `address` (alert-email verification).
async function issueCode(user, purpose, address) {
  if (tooSoon(user.verifyCodeSentAt)) {
    throw httpError(429, 'Please wait a minute before asking for another code');
  }
  const code = newCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      verifyCodeHash: await bcrypt.hash(code, 8),
      verifyCodeExpires: new Date(Date.now() + CODE_TTL_MS),
      verifyCodeFor: purpose,
      verifyAttempts: 0,
      verifyCodeSentAt: new Date(),
    },
  });
  await mailCode(code, address);
}

// Checks a code typed by the user. Resolves true and clears the pending code when it is
// right; throws a readable 400 when it is wrong, expired or tried too often.
async function checkCode(user, purpose, code) {
  if (!user.verifyCodeHash || user.verifyCodeFor !== purpose) {
    throw httpError(400, 'There is no code waiting. Ask for a new one.');
  }
  if (!user.verifyCodeExpires || new Date(user.verifyCodeExpires) < new Date()) {
    throw httpError(400, 'That code has expired. Ask for a new one.');
  }
  if (user.verifyAttempts >= MAX_ATTEMPTS) {
    throw httpError(400, 'Too many wrong tries. Ask for a new code.');
  }
  const ok = await bcrypt.compare(String(code || '').trim(), user.verifyCodeHash);
  if (!ok) {
    await prisma.user.update({ where: { id: user.id }, data: { verifyAttempts: { increment: 1 } } });
    throw httpError(400, 'That code is not right. Check it and try again.');
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyCodeHash: null, verifyCodeExpires: null, verifyCodeFor: null, verifyAttempts: 0 },
  });
  return true;
}

// ---------- Sign-up: the account is only created after the emailed code is right ----------

// Stores the sign-up details and emails the first code. Nothing is added to User yet.
async function startSignup({ email, name, phone, passwordHash, receiveUpdates }) {
  const existing = await prisma.pendingSignup.findUnique({ where: { email } });
  if (existing && tooSoon(existing.sentAt)) {
    throw httpError(429, 'A code was just sent. Please wait a minute before asking for another one.');
  }
  const code = newCode();
  const data = {
    name,
    phone: phone || null,
    passwordHash,
    receiveUpdates: Boolean(receiveUpdates),
    codeHash: await bcrypt.hash(code, 8),
    codeExpires: new Date(Date.now() + CODE_TTL_MS),
    attempts: 0,
    sentAt: new Date(),
  };
  await prisma.pendingSignup.upsert({ where: { email }, create: { email, ...data }, update: data });
  try {
    await mailCode(code, email);
  } catch (err) {
    await prisma.pendingSignup.deleteMany({ where: { email } });
    throw err;
  }
}

// Sends a new code for a sign-up that is waiting. Returns false when none is waiting.
async function resendSignupCode(email) {
  const pending = await prisma.pendingSignup.findUnique({ where: { email } });
  if (!pending) return false;
  if (tooSoon(pending.sentAt)) {
    throw httpError(429, 'Please wait a minute before asking for another code');
  }
  const code = newCode();
  await prisma.pendingSignup.update({
    where: { email },
    data: {
      codeHash: await bcrypt.hash(code, 8),
      codeExpires: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
      sentAt: new Date(),
    },
  });
  await mailCode(code, email);
  return true;
}

// Checks the code and, when right, creates the resident's account. Returns the new User.
async function finishSignup(email, code) {
  const pending = await prisma.pendingSignup.findUnique({ where: { email } });
  if (!pending) throw httpError(400, 'That code is not right. Check it and try again.');
  if (new Date(pending.codeExpires) < new Date()) {
    throw httpError(400, 'That code has expired. Ask for a new one.');
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    throw httpError(400, 'Too many wrong tries. Ask for a new code.');
  }
  const ok = await bcrypt.compare(String(code || '').trim(), pending.codeHash);
  if (!ok) {
    await prisma.pendingSignup.update({ where: { email }, data: { attempts: { increment: 1 } } });
    throw httpError(400, 'That code is not right. Check it and try again.');
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    await prisma.pendingSignup.deleteMany({ where: { email } });
    throw httpError(400, 'Email is already registered');
  }
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        name: pending.name,
        email,
        phone: pending.phone,
        passwordHash: pending.passwordHash,
        role: 'VIEWER',
        emailVerifiedAt: new Date(),
        receiveUpdates: pending.receiveUpdates,
        updatesSince: pending.receiveUpdates ? new Date() : null,
        unsubscribeToken: pending.receiveUpdates ? crypto.randomBytes(24).toString('hex') : null,
      },
    }),
    prisma.pendingSignup.delete({ where: { email } }),
  ]);
  return user;
}

// Sign-ups nobody finished within a day are forgotten.
async function cleanupPendingSignups() {
  await prisma.pendingSignup.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

module.exports = {
  issueCode,
  checkCode,
  startSignup,
  resendSignupCode,
  finishSignup,
  cleanupPendingSignups,
};
