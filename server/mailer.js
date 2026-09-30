// RHMS mailer — single place for outgoing SMTP email (Nodemailer).
// Configuration comes only from environment variables (server/.env); no
// credentials are hard-coded. When SMTP is not configured, isSmtpConfigured()
// returns false and callers fall back to the existing in-app + console channel.
const nodemailer = require('nodemailer');

let cachedTransporter = null;

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

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const s = smtpSettings();
  cachedTransporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: { user: s.user, pass: s.pass },
  });
  return cachedTransporter;
}

async function verifySmtp() {
  return getTransporter().verify();
}

async function sendMail({ to, subject, text, html }) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured');
  }
  const s = smtpSettings();
  return getTransporter().sendMail({
    from: s.from || s.user,
    to,
    subject,
    text,
    html,
  });
}

module.exports = { isSmtpConfigured, getTransporter, verifySmtp, sendMail, smtpSettings };
