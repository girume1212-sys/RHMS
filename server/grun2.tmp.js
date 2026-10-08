process.env.PORT = '5001';
const mailer = require('./mailer');
const sent = [];
mailer.sendMail = async (opts) => {
  sent.push({ to: opts.to, subject: opts.subject, html: opts.html });
  return { messageId: 'captured' };
};
require('./server.js');
const B = 'http://localhost:5001';
(async () => {
  await new Promise((res) => setTimeout(res, 4000));
  const login = async (e) => (await (await fetch(B + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: e, password: 'test1234' }) })).json()).token;
  const clientTok = await login('clientA@test.local');
  const r = await fetch(B + '/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clientTok }, body: JSON.stringify({ subject: 'Group1 Leak Test', description: 'VPN keeps dropping.', categoryId: '3', priorityId: '3' }) });
  const reqId = (await r.json()).id;
  console.log('created:', reqId);
  await new Promise((res) => setTimeout(res, 3000));
  const groupMails = sent.filter((s) => s.subject.startsWith('New Support Request for Your Group'));
  console.log('group recipients:', groupMails.map((s) => s.to));
  const outsiderGot = groupMails.some((s) => s.to === 'outsider@test.local');
  console.log('outsider emailed (expect false):', outsiderGot);
  const m = groupMails[0];
  if (m) {
    const t = m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('body:', t.slice(0, 1100));
  }
  process.exit(0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
