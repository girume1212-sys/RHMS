const http = require('http');
const post = (path, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const req = http.request({ host: 'localhost', port: 5003, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
    let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b }));
  });
  req.on('error', reject); req.write(data); req.end();
});
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'rhms', user: 'etech', password: 'etech' });
(async () => {
  const email = 'rhmsflowtest1@gmail.com';
  await pool.query("DELETE FROM email_verification_codes WHERE email=$1", [email]);
  await pool.query("DELETE FROM users WHERE email=$1", [email]);
  const r1 = await post('/api/auth/request-email-verification', { name: 'Flow Tester', email, password: 'password123' });
  console.log('request_code:', r1.status, r1.body);
  // Simulate reading the inbox: fetch latest unused hash is one-way, so verify by
  // brute-forcing? No - instead check the mail log on server. For flow test, use verify endpoint with wrong code first:
  const r2 = await post('/api/auth/verify-email-code', { email, code: '000000' });
  console.log('wrong_code:', r2.status, r2.body);
  await pool.end();
})();
