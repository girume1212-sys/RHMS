const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
(async () => {
  const r = await pool.query("SELECT email FROM users WHERE role='client'");
  console.log(JSON.stringify(r.rows.map(x=>x.email)));
  await pool.end();
})();