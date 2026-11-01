const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
(async () => {
  const r = await pool.query("SELECT id,user_id,type,message,created_at FROM notifications WHERE user_id='3' ORDER BY created_at DESC LIMIT 3");
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
})();