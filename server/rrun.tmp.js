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
  const clientTok = await login('rclient@test.local');
  const r = await fetch(B + '/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + clientTok }, body: JSON.stringify({ subject: 'Split Template Test', description: 'd', categoryId: '1', priorityId: '2' }) });
  const reqId = (await r.json()).id;
  console.log('created:', reqId);
  await new Promise((res) => setTimeout(res, 3000));
  const groupMails = sent.filter((s) => s.subject.includes('Group'));
  for (const m of groupMails) console.log('TO:', m.to, '| SUBJECT:', m.subject);
  const devA = groupMails.find((s) => s.to === 'rdevA@test.local');
  const escA = groupMails.find((s) => s.to === 'rEscA@test.local');
  console.log('devA subject ok:', devA && devA.subject === `New Support Request Assigned to Your Group - #${reqId}`);
  console.log('escA subject ok:', escA && escA.subject === `New Support Request for Your Group - #${reqId}`);
  const outsiders = groupMails.filter((s) => s.to.startsWith('rOut'));
  console.log('outsiders emailed (expect 0):', outsiders.length);
  if (devA) {
    const t = devA.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('devA body:', t.slice(0, 900));
  }
  process.exit(0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
