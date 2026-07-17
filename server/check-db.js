const {Pool} = require('pg');
const p = new Pool({host:'localhost',port:5432,database:'rhms',user:'postgres',password:'etech',connectionTimeoutMillis:5000});
p.query("SELECT COUNT(*) as count FROM users")
  .then(r => { console.log('Users:', r.rows[0].count); return p.query("SELECT email, role FROM users"); })
  .then(r => { r.rows.forEach(u => console.log(u.email, '-', u.role)); p.end(); })
  .catch(e => { console.error(e.message); p.end(); });
