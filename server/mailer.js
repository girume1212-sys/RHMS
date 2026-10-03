// RHMS mailer — single place for outgoing SMTP email (Nodemailer).
// Configuration comes only from environment variables (server/.env); no
// credentials are hard-coded. When SMTP is not configured, isSmtpConfigured()
// returns false and callers fall back to the existing in-app + console channel.
const nodemailer = require('nodemailer');

// Fail fast instead of hanging for minutes on an unreachable SMTP host.
const SMTP_TIMEOUT_MS = Math.max(
  1000,
  parseInt(process.env.SMTP_TIMEOUT_MS || '10000', 10) || 10000
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
  return [s.host, s.port, s.secure, s.user, String(s.pass || '').length].join('|');
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
    const err = new Error('SMTP is not configured');
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }
  return withTimeout(getTransporter().verify(), SMTP_TIMEOUT_MS, 'SMTP verify timed out');
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
  const e = new Error('SMTP_UNAVAILABLE');
  e.cause = err;
  return e;
}

async function sendMail({ to, subject, text, html }) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const s = smtpSettings();
  try {
    const info = await withTimeout(
      getTransporter().sendMail({
        from: s.from || s.user,
        to,
        subject,
        text,
        html,
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
