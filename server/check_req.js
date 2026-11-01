const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
(async () => {
  const r = await pool.query("SELECT id,client_id,assigned_to FROM requests WHERE assigned_to='4' LIMIT 1");
  console.log(JSON.stringify(r.rows));
  await pool.end();
})();