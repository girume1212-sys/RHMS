const p = require('./db');
async function test() {
  try {
    const r = await p.query("SELECT al.*, u.name as user_name FROM activity_log al LEFT JOIN users u ON al.user_id = u.id WHERE al.request_id = $1 ORDER BY al.created_at DESC", ['REQ-2024-00188']);
    console.log('rows:', JSON.stringify(r.rows, null, 2));
  } catch(e) {
    console.error(e.message);
  } finally {
    p.end();
  }
}
test();
