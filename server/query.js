const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'rhms',
  user: 'etech',
  password: 'etech',
});
pool.query(`SELECT u.company_name, s.name AS status_name, COUNT(*)::int AS count FROM requests r LEFT JOIN users u ON r.client_id = u.id LEFT JOIN statuses s ON r.status_id = s.id WHERE r.created_at::date >= ('2026-07-28'::date - INTERVAL '1 day' * 30) AND u.company_name IS NOT NULL AND u.company_name != '' GROUP BY u.company_name, s.name ORDER BY u.company_name, s.name`)
  .then(r => { console.log('SUCCESS:', JSON.stringify(r.rows)); process.exit(0); })
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
