const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'rhms', user: 'postgres', password: 'etech' });
(async () => {
  const col = await pool.query(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'comments' ORDER BY ordinal_position`);
  console.log('comments columns:', col.rows.map(r => r.column_name).join(', '));
  const sample = await pool.query(`SELECT c.id, c.content, c.attachments, u.name, u.role FROM comments c LEFT JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC LIMIT 5`);
  console.log('sample comments:', JSON.stringify(sample.rows, null, 2));
  const req = await pool.query(`SELECT id, subject FROM requests ORDER BY created_at DESC LIMIT 3`);
  console.log('recent requests:', req.rows);
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
