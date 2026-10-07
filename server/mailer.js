// RHMS mailer — single place for outgoing SMTP email (Nodemailer).
// Configuration comes only from environment variables (server/.env); no
// credentials are hard-coded. When SMTP is not configured, isSmtpConfigured()
// returns false and callers fall back to the existing in-app + console channel.
const nodemailer = require('nodemailer');

// Fail fast instead of hanging for minutes on an unreachable SMTP host.
const SMTP_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.SMTP_TIMEOUT_MS || '30000', 10) || 30000
);

let cachedTransporter = null;
let cachedKey = '';

function smtpSettings() {
  return {
    host: (process.env.SMTP_HOST || '').trim(),
    port: parseInt(process.env.SMTP_PORT || '587', 10) || 587,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
    user: (process.env.SMTP_USER || '').trim(),
    pass: process.env.SMTP_PASS || '',
    from: (process.env.SMTP_FROM || '').trim(),
  };
}

function isSmtpConfigured() {
  const s = smtpSettings();
  return Boolean(s.host && s.user && s.pass);
}

function settingsKey(s) {
  // Hash the password so a changed app-password busts the cached transporter
  // (length alone is not enough) without keeping the secret in memory as-is.
  const crypto = require('crypto');
  const passHash = crypto.createHash('sha256').update(String(s.pass || '')).digest('hex').slice(0, 16);
  return [s.host, s.port, s.secure, s.user, passHash].join('|');
}

function getTransporter() {
  const s = smtpSettings();
  const key = settingsKey(s);
  if (cachedTransporter && cachedKey === key) return cachedTransporter;
  if (cachedTransporter) {
    try { cachedTransporter.close(); } catch (e) { /* ignore */ }
  }
  cachedTransporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  cachedKey = key;
  return cachedTransporter;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(label || 'Operation timed out');
      err.code = 'ETIMEDOUT';
      reject(err);
    }, ms);
    if (timer.unref) timer.unref();
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function verifySmtp() {
  if (!isSmtpConfigured()) {
    const err = new Error('SMTP_NOT_CONFIGURED');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  try {
    return await withTimeout(getTransporter().verify(), SMTP_TIMEOUT_MS, 'SMTP verify timed out');
  } catch (err) {
    throw classifySmtpError(err);
  }
}

// Classify nodemailer errors without leaking credentials/host details.
function classifySmtpError(err) {
  const msg = String((err && err.message) || '');
  const code = String((err && (err.code || err.responseCode)) || '').toUpperCase();
  if (code.includes('EAUTH') || /auth|535|534|535-5|username|password|credentials/i.test(msg)) {
    const e = new Error('SMTP_AUTH');
    e.cause = err;
    return e;
  }
  if (code.includes('ETIMEDOUT') || code.includes('ESOCKET') || code.includes('ETIMEOUT') || /timed out|timeout/i.test(msg)) {
    const e = new Error('SMTP_TIMEOUT');
    e.cause = err;
    return e;
  }
  // Recipient mailbox does not exist (Gmail 550 5.1.1 NoSuchUser). The sender
  // config is fine — the destination address is wrong or misspelled.
  if (/5\.1\.1|nosuchuser|mailbox unavailable|recipient address rejected|user unknown|invalid recipient/i.test(msg)) {
    const e = new Error('SMTP_NO_SUCH_USER');
    e.cause = err;
    return e;
  }
  const e = new Error('SMTP_UNAVAILABLE');
  e.cause = err;
  return e;
}

async function sendMail({ to, subject, text, html, attachments }) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const s = smtpSettings();
  try {
    const info = await withTimeout(
      getTransporter().sendMail({
        from: `"Request Handling Management System" <${process.env.SMTP_FROM}>`,
        // Reply-To matching From: consistent sender identity, no reply black hole.
        replyTo: `"Request Handling Management System" <${process.env.SMTP_FROM}>`,
        to,
        subject,
        text,
        html,
        attachments,
      }),
      SMTP_TIMEOUT_MS,
      'SMTP send timed out'
    );
    return info;
  } catch (err) {
    if (err && (err.message === 'SMTP_TIMEOUT' || err.code === 'ETIMEDOUT')) throw err;
    throw classifySmtpError(err);
  }
}

module.exports = { isSmtpConfigured, getTransporter, verifySmtp, sendMail, smtpSettings, classifySmtpError, SMTP_TIMEOUT_MS };
