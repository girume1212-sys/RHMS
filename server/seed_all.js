const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const pool = new Pool({ host: 'localhost', port: 5432, database: 'rhms', user: 'etech', password: 'etech' });

const statuses = ['1','2','3','4','5','6'];
const cats = ['1','2','3','4','5','6','7','8'];
const pris = ['1','2','3','4'];
const clients = ['5','6','7','8','9','10'];
const devs = ['3','4'];

async function q(c, sql, params){ return c.query(sql, params); }

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const groups = [
      ['1','Client','Client group','#10B981'],
      ['2','Escalation Team','Escalation and support team','#3B82F6'],
      ['3','Developer','Development team','#8B5CF6'],
      ['4','Admin','Administration team','#EF4444'],
    ];
    for (const g of groups) await q(client,'INSERT INTO groups (id,name,description,color) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',g);
    const users = [
      ['1','John Admin','admin@rhms.com','admin123','admin','4'],
      ['2','Sarah Support','support@rhms.com','support123','support','2'],
      ['3','Michael Developer','dev@rhms.com','dev123','developer','3'],
      ['4','Emily Developer','emily@rhms.com','dev123','developer','3'],
      ['5','James Wilson','james@client.com','client123','client','1'],
      ['6','Sarah Johnson','sarah@client.com','client123','client','1'],
      ['7','David Brown','david@client.com','client123','client','1'],
      ['8','Lisa Anderson','lisa@client.com','client123','client','1'],
      ['9','Robert Taylor','robert@client.com','client123','client','1'],
      ['10','Maria Garcia','maria@client.com','client123','client','1'],
    ];
    for (const u of users) {
      const hash = bcrypt.hashSync(u[3],10);
      await q(client,'INSERT INTO users (id,name,email,password,role,group_id,avatar,created_at) VALUES ($1,$2,$3,$4,$5,$6,NULL,NOW()) ON CONFLICT (id) DO NOTHING',[u[0],u[1],u[2],hash,u[4],u[5]]);
    }
    const cats = [['1','Hardware','Computer, printer, peripherals','#3B82F6'],['2','Software','Applications, OS, licensing','#10B981'],['3','Network','WiFi, internet, connectivity','#F59E0B'],['4','Security','Viruses, malware, access issues','#EF4444'],['5','Email','Email setup, calendar, Outlook','#8B5CF6'],['6','Account','Login, password, permissions','#06B6D4'],['7','Data','Backup, recovery, storage','#EC4899'],['8','Other','General inquiries, other issues','#6B7280']];
    for (const c of cats) await q(client,'INSERT INTO categories (id,name,description,color) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',c);
    const pris = [['1','Low','#3B82F6',1],['2','Medium','#F59E0B',2],['3','High','#EF4444',3],['4','Critical','#DC2626',4]];
    for (const p of pris) await q(client,'INSERT INTO priorities (id,name,color,level) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',p);
    const sts = [['1','New','#3B82F6'],['2','Assigned','#8B5CF6'],['3','In Progress','#F59E0B'],['4','Waiting for Client','#F97316'],['5','Resolved','#10B981'],['6','Closed','#6B7280']];
    for (const s of sts) await q(client,'INSERT INTO statuses (id,name,color) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',s);

    
    let inserted = 0;
    for (let i = 1; i <= 128; i++) {
      const num = String(129 - i).padStart(3,'0'); 
      const id = 'REQ-2024-' + num;
      const clientId = clients[i % clients.length];
      const catId = cats[i % cats.length][0];
      const priId = pris[i % pris.length][0];
      const stId = statuses[i % statuses.length];
      const assigned = (stId === '1') ? null : devs[i % devs.length];
      const day = 1 + (i % 28);
      const createdAt = new Date(2024, 4, day, 9, (i*3)%60).toISOString();
      const updatedAt = new Date(2024, 4, day, 12, (i*5)%60).toISOString();
      const subjects = ['Printer not working','Software update failing','WiFi dropping','Suspicious email','Outlook not syncing','VPN issue','Data backup needed','New monitor request','Install Adobe Suite','Slow internet','Password reset needed','Antivirus alert','Laptop battery draining','Shared drive access','Zoom audio issues','New employee laptop setup','Email configuration','Hardware replacement','Network outage','Account locked'];
      const subject = subjects[i % subjects.length] + ' #' + i;
      const desc = 'Auto-generated development request ' + i + ' for RHMS testing.';
      const r = await q(client, `INSERT INTO requests (id,subject,description,client_id,category_id,priority_id,status_id,assigned_to,attachments,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'[]',$9,$10) ON CONFLICT (id) DO NOTHING`,
        [id,subject,desc,clientId,catId,priId,stId,assigned,createdAt,updatedAt]);
      if (r.rowCount) inserted++;
      
      if (i % 3 === 0) {
        const cid = 'c_' + id;
        await q(client, 'INSERT INTO comments (id,request_id,user_id,content,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
          [cid, id, assigned || clientId, 'Development comment for ' + id, updatedAt]);
      }
      
      const aid = 'a_' + id;
      await q(client, 'INSERT INTO activity_log (id,type,request_id,user_id,message,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
        [aid, 'created', id, clientId, 'New request created', createdAt]);
      
      const nid = 'n_' + id;
      await q(client, 'INSERT INTO notifications (id,user_id,message,type,is_read,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
        [nid, clientId, 'Your request ' + id + ' was created', 'info', false, createdAt]);
    }
    await client.query('COMMIT');
    console.log('Inserted/ensured 128 requests. New this run: ' + inserted);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
seed();