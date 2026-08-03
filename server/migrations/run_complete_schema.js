const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'complete_schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('RHMS schema completion migration applied successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exitCode = 1;
  } finally {
    pool.end();
  }
}

migrate();
