const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const pool = require('./db');

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_groups (
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, group_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#6B7280'
      )
    `);
    await pool.query(`
      INSERT INTO groups (id, name, description, color) VALUES
        ('1', 'Client', 'Client group', '#10B981'),
        ('2', 'Escalation Team', 'Escalation and support team', '#3B82F6'),
        ('3', 'Developer', 'Development team', '#8B5CF6'),
        ('4', 'Admin', 'Administration team', '#EF4444')
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO user_groups (user_id, group_id)
      SELECT id, group_id FROM users WHERE group_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
    await pool.query(`ALTER TABLE groups ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL`);
    console.log('user_groups table and groups ready');

    // Create request_groups junction table for group-based visibility
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_groups (
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (request_id, group_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_request_groups_request_id ON request_groups(request_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_request_groups_group_id ON request_groups(group_id)`);

    // Backfill: populate request_groups for existing requests based on client's group memberships
    await pool.query(`
      INSERT INTO request_groups (request_id, group_id)
      SELECT r.id, COALESCE(ug.group_id, u.group_id)
      FROM requests r
      JOIN users u ON r.client_id = u.id
      LEFT JOIN user_groups ug ON r.client_id = ug.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM request_groups rg WHERE rg.request_id = r.id
      )
      AND (ug.group_id IS NOT NULL OR u.group_id IS NOT NULL)
      ON CONFLICT DO NOTHING
    `);

    console.log('request_groups table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#6B7280'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(50) PRIMARY KEY,
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(request_id, user_id)
      )
    `);
    console.log('feedback table ready');
    await pool.query(`
      INSERT INTO categories (id, name, description, color) VALUES
        ('1', 'Hardware', 'Computer, printer, peripherals', '#3B82F6'),
        ('2', 'Software', 'Applications, OS, licensing', '#10B981'),
        ('3', 'Network', 'WiFi, internet, connectivity', '#F59E0B'),
        ('4', 'Security', 'Viruses, malware, access issues', '#EF4444'),
        ('5', 'Email', 'Email setup, calendar, Outlook', '#8B5CF6'),
        ('6', 'Account', 'Login, password, permissions', '#06B6D4'),
        ('7', 'Data', 'Backup, recovery, storage', '#EC4899'),
        ('8', 'Other', 'General inquiries, other issues', '#6B7280')
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, color = EXCLUDED.color
    `);
    console.log('categories ready');
    await pool.query(`
      CREATE SEQUENCE IF NOT EXISTS requests_id_seq
      START WITH 129
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1
    `);
    // Sync sequence to current max ID
    await pool.query("SELECT setval('requests_id_seq', COALESCE((SELECT MAX(CAST(SPLIT_PART(id, '-', 3) AS INTEGER)) FROM requests WHERE id LIKE 'REQ-2024-%'), 128))");
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS priority_id VARCHAR(50)`);
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS status_id VARCHAR(50)`);
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]'`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]'`);
    console.log('requests columns ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT ''`);
    console.log('company_name column ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en'`);
    console.log('language column ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0`);
    console.log('approved column ready');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(50) PRIMARY KEY,
        company_id VARCHAR(100) UNIQUE,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        company_type VARCHAR(50),
        email VARCHAR(255),
        phone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('companies table ready');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id VARCHAR(50) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        request_id VARCHAR(50),
        user_id VARCHAR(50) REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('activity_log table ready');
    await pool.query(`
      INSERT INTO statuses (id, name, color) VALUES ('8', 'Rejected', '#DC2626')
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO statuses (id, name, color) VALUES ('9', 'Escalated', '#EF4444')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log('statuses ready');

    // --- New tables ---

    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
        tags TEXT[],
        status VARCHAR(20) DEFAULT 'published',
        views INTEGER DEFAULT 0,
        created_by VARCHAR(50) REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('knowledge_base table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        priority VARCHAR(20) DEFAULT 'normal',
        target_role VARCHAR(20),
        created_by VARCHAR(50) REFERENCES users(id),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('announcements table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sla_policies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id VARCHAR(50) REFERENCES categories(id) ON DELETE CASCADE,
        priority_id VARCHAR(50) REFERENCES priorities(id) ON DELETE CASCADE,
        response_time_minutes INTEGER NOT NULL,
        resolution_time_minutes INTEGER NOT NULL,
        escalation_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('sla_policies table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        color VARCHAR(20) DEFAULT '#6B7280',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_tags (
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        tag_id VARCHAR(50) REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (request_id, tag_id)
      )
    `);
    console.log('tags and request_tags tables ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        description TEXT,
        category_id VARCHAR(50) REFERENCES categories(id) ON DELETE SET NULL,
        priority_id VARCHAR(50) REFERENCES priorities(id) ON DELETE SET NULL,
        is_public BOOLEAN DEFAULT true,
        created_by VARCHAR(50) REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('templates table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attachments (
        id VARCHAR(50) PRIMARY KEY,
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id),
        filename VARCHAR(500) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('attachments table ready');
  } catch (err) {
    console.log('Init error:', err.message);
  }
})();

const app = express();
const PORT = 5000;
const JWT_SECRET = 'rhms-secret-key-2024';
const googleClient = new OAuth2Client();

// SSE clients for real-time notifications
const sseClients = new Map(); // userId -> Set of response objects

app.use(cors());
app.use(express.json());
app.use((req, res, next) => { console.log(new Date().toISOString(), req.method, req.url, 'Content-Type:', req.headers['content-type'] || 'none'); next(); });
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../client/build')));
app.use('/api', maintenanceMiddleware);


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid token' });
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const roleMiddleware = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

async function maintenanceMiddleware(req, res, next) {
  try {
    const result = await pool.query("SELECT value FROM system_settings WHERE key = 'maintenanceMode'");
    if (result.rows.length > 0 && result.rows[0].value === 'true' && req.user?.role !== 'admin') {
      return res.status(503).json({ error: 'System is under maintenance. Please try again later.' });
    }
    next();
  } catch { next(); }
};

// SSE notification helper
function notifyAdmins(message, data = {}) {
  const payload = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
  for (const [userId, clients] of sseClients) {
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

function notifyAll(message, data = {}) {
  const payload = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
  for (const [userId, clients] of sseClients) {
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

function notifyUser(userId, message, data = {}) {
  const clients = sseClients.get(userId);
  if (clients) {
    const payload = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
}

// Sync a user's existing requests to their group memberships so that requests
// created before the user was assigned to a group become visible to that group.
// Only requests without an explicit group assignment are managed here.
async function syncUserRequestGroups(userId, groupIds) {
  if (!userId) return {};
  const groupList = Array.isArray(groupIds) ? groupIds.filter(Boolean) : [];
  const added = {};
  const userRequests = await pool.query(
    'SELECT id FROM requests WHERE client_id = $1 AND assigned_group IS NULL',
    [userId]
  );
  for (const r of userRequests.rows) {
    if (groupList.length > 0) {
      await pool.query(
        'DELETE FROM request_groups WHERE request_id = $1 AND NOT (group_id = ANY($2::text[]))',
        [r.id, groupList]
      );
    } else {
      await pool.query('DELETE FROM request_groups WHERE request_id = $1', [r.id]);
    }
    for (const gid of groupList) {
      const result = await pool.query(
        'INSERT INTO request_groups (request_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [r.id, gid]
      );
      if (result.rowCount > 0) added[gid] = (added[gid] || 0) + result.rowCount;
    }
  }
  return added;
}

// Incrementally associate one group with a user's existing requests
async function addUserRequestGroup(userId, groupId) {
  if (!userId || !groupId) return 0;
  const result = await pool.query(
    `INSERT INTO request_groups (request_id, group_id)
     SELECT r.id, $2
     FROM requests r
     WHERE r.client_id = $1 AND r.assigned_group IS NULL
     ON CONFLICT DO NOTHING`,
    [userId, groupId]
  );
  return result.rowCount || 0;
}

// Remove a group association from a user's existing requests (unless the
// request was explicitly assigned to that group)
async function removeUserRequestGroup(userId, groupId) {
  if (!userId || !groupId) return;
  await pool.query(
    `DELETE FROM request_groups rg
     USING requests r
     WHERE rg.request_id = r.id
       AND r.client_id = $1
       AND rg.group_id = $2
       AND r.assigned_group IS DISTINCT FROM $2`,
    [userId, groupId]
  );
}

// Notify developer/support members of a group so their dashboards update
async function notifyGroupMembers(groupId, message, data = {}) {
  try {
    const groupResult = await pool.query('SELECT name FROM groups WHERE id = $1', [groupId]);
    const groupName = groupResult.rows[0]?.name || '';
    const membersResult = await pool.query(
      "SELECT u.id FROM user_groups ug JOIN users u ON u.id = ug.user_id WHERE ug.group_id = $1 AND u.role IN ('developer', 'support')",
      [groupId]
    );
    const payload = { type: 'group_assigned', groupId, groupName, ...data };
    for (const row of membersResult.rows) {
      notifyUser(row.id, message, payload);
    }
  } catch (err) {
    console.error('notifyGroupMembers error:', err.message);
  }
}

const mapUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  companyName: u.company_name || '',
  language: u.language || 'en',
  approved: u.approved || false,
  createdAt: u.created_at
});

const mapRequest = (r) => ({
  id: r.id,
  subject: r.subject,
  description: r.description,
  clientId: r.client_id,
  categoryId: r.category_id,
  priorityId: r.priority_id,
  statusId: r.status_id,
  assignedTo: r.assigned_to,
  attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

// SSE endpoint for real-time notifications (token via query param for EventSource)
app.get('/api/notifications/stream', async (req, res) => {
  // Auth via query param since EventSource doesn't support headers
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  const userResult = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
  if (userResult.rows.length === 0) return res.status(401).json({ error: 'Invalid token' });
  req.user = userResult.rows[0];

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ message: 'Connected', timestamp: new Date().toISOString() })}\n\n`);

  const userId = req.user.id;
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  // Send initial unread count
  pool.query('SELECT COUNT(*) FROM activity_log WHERE created_at > NOW() - INTERVAL \'24 hours\'')
    .then(result => {
      const count = parseInt(result.rows[0].count);
      res.write(`data: ${JSON.stringify({ type: 'init', count, timestamp: new Date().toISOString() })}\n\n`);
    })
    .catch(() => {});

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
});

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, companyName, language } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const pwResult = await pool.query("SELECT value FROM system_settings WHERE key = 'passwordLength'");
    const minLength = pwResult.rows.length > 0 ? parseInt(pwResult.rows[0].value) || 8 : 8;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password, role, company_name, language) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, role, avatar, created_at, company_name, language',
      [id, name, email, hashedPassword, 'client', companyName || '', ['en', 'am'].includes(language) ? language : 'en']
    );

    // Auto-assign to default group
    const defGroup = await pool.query("SELECT value FROM system_settings WHERE key = 'defaultGroup'");
    const defaultGroupId = defGroup.rows.length > 0 ? defGroup.rows[0].value : '';
    if (defaultGroupId) {
      await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, defaultGroupId]);
    }

    res.status(201).json({ message: 'Account created successfully', user: mapUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Please try again' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const credential = username || email;
    const result = await pool.query(
      'SELECT * FROM users WHERE name = $1 OR email = $1',
      [credential]
    );
    const user = result.rows[0];

    const attemptResult = await pool.query("SELECT value FROM system_settings WHERE key = 'maxLoginAttempts'");
    const maxAttempts = attemptResult.rows.length > 0 ? parseInt(attemptResult.rows[0].value) || 5 : 5;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      if (user) {
        const currentAttempts = (user.login_attempts || 0) + 1;
        await pool.query('UPDATE users SET login_attempts = $1 WHERE id = $2', [currentAttempts, user.id]);
        if (currentAttempts >= maxAttempts) {
          await pool.query("UPDATE users SET approved = false WHERE id = $1", [user.id]);
        }
      }
      return res.status(401).json({ error: 'Invalid username, email or password' });
    }

    if (user.login_attempts >= maxAttempts) {
      return res.status(423).json({ error: 'Account locked due to too many failed attempts. Contact administrator.' });
    }

    await pool.query('UPDATE users SET login_attempts = 0 WHERE id = $1', [user.id]);

    const sessionResult = await pool.query("SELECT value FROM system_settings WHERE key = 'sessionTimeout'");
    const sessionTimeout = sessionResult.rows.length > 0 ? parseInt(sessionResult.rows[0].value) || 30 : 30;
    const expiresIn = sessionTimeout > 0 ? `${sessionTimeout}m` : '24h';

    const token = jwt.sign({ id: user.id, role: user.role, sessionTimeout }, JWT_SECRET, { expiresIn });
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(mapUser(req.user));
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    });
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    let user;

    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      const id = uuidv4();
      result = await pool.query(
        'INSERT INTO users (id, name, email, password, role, avatar) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [id, name, email, bcrypt.hashSync(googleId, 10), 'client', picture || null]
      );
      user = result.rows[0];
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Users Routes
app.get('/api/users', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.company_name, u.language, u.approved, u.created_at
      FROM users u
      ORDER BY u.created_at DESC
    `);
    const users = result.rows.map(u => mapUser(u));
    try {
      const groupResult = await pool.query(`
        SELECT ug.user_id, g.id AS group_id, g.name AS group_name, g.color AS group_color
        FROM user_groups ug
        JOIN groups g ON ug.group_id = g.id
      `);
      const userGroups = {};
      for (const row of groupResult.rows) {
        if (!userGroups[row.user_id]) userGroups[row.user_id] = { groupIds: [], groupNames: [], groupColors: [] };
        userGroups[row.user_id].groupIds.push(row.group_id);
        userGroups[row.user_id].groupNames.push(row.group_name);
        userGroups[row.user_id].groupColors.push(row.group_color);
      }
      for (const u of users) {
        const g = userGroups[u.id] || { groupIds: [], groupNames: [], groupColors: [] };
        u.groupIds = g.groupIds;
        u.groupNames = g.groupNames;
        u.groupColors = g.groupColors;
      }
    } catch (e) {
      for (const u of users) {
        u.groupIds = [];
        u.groupNames = [];
        u.groupColors = [];
      }
    }
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, password, role, groupIds, companyName, language } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, company_name, language) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, email, hashedPassword, role || 'client', companyName || '', ['en', 'am'].includes(language) ? language : 'en']
    );
    try {
      if (groupIds && groupIds.length > 0) {
        for (const gid of groupIds) {
          await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, gid]);
        }
      } else {
        const defGroup = await pool.query("SELECT value FROM system_settings WHERE key = 'defaultGroup'");
        const defaultGroupId = defGroup.rows.length > 0 ? defGroup.rows[0].value : '';
        if (defaultGroupId) {
          await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, defaultGroupId]);
        }
      }
    } catch (e) {}
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const user = mapUser(result.rows[0]);
    try {
      const groupResult = await pool.query(`
        SELECT g.id AS group_id, g.name AS group_name, g.color AS group_color
        FROM user_groups ug
        JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = $1
      `, [id]);
      user.groupIds = groupResult.rows.map(r => r.group_id);
      user.groupNames = groupResult.rows.map(r => r.group_name);
      user.groupColors = groupResult.rows.map(r => r.group_color);
    } catch (e) {
      user.groupIds = [];
      user.groupNames = [];
      user.groupColors = [];
    }
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, role, groupIds, password, companyName, language } = req.body;
    const lang = ['en', 'am'].includes(language) ? language : undefined;
    let query, params;
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), password = $4, company_name = COALESCE($5, company_name), language = COALESCE($6, language) WHERE id = $7 RETURNING *';
      params = [name, email, role, hashedPassword, companyName, lang, req.params.id];
    } else {
      query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), company_name = COALESCE($4, company_name), language = COALESCE($5, language) WHERE id = $6 RETURNING *';
      params = [name, email, role, companyName, lang, req.params.id];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    try {
    await pool.query('UPDATE feedback SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM user_groups WHERE user_id = $1', [req.params.id]);
      if (groupIds && groupIds.length > 0) {
        for (const gid of groupIds) {
          await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, gid]);
        }
      }
      // Sync request_groups for user's existing requests (only if not explicitly group-assigned)
      const addedGroups = await syncUserRequestGroups(req.params.id, groupIds);
      for (const gid of Object.keys(addedGroups)) {
        notifyGroupMembers(gid, `${addedGroups[gid]} new request${addedGroups[gid] > 1 ? 's' : ''} available for your group`, { groupId: gid });
      }
    } catch (e) { console.log('user_groups save error:', e.message); }
    const user = mapUser(result.rows[0]);
    try {
      const groupResult = await pool.query(`
        SELECT g.id AS group_id, g.name AS group_name, g.color AS group_color
        FROM user_groups ug
        JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = $1
      `, [req.params.id]);
      user.groupIds = groupResult.rows.map(r => r.group_id);
      user.groupNames = groupResult.rows.map(r => r.group_name);
      user.groupColors = groupResult.rows.map(r => r.group_color);
    } catch (e) {
      user.groupIds = [];
      user.groupNames = [];
      user.groupColors = [];
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    await pool.query('UPDATE requests SET client_id = NULL WHERE client_id = $1', [req.params.id]);
    await pool.query('UPDATE requests SET assigned_to = NULL WHERE assigned_to = $1', [req.params.id]);
    await pool.query('UPDATE comments SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('UPDATE activity_log SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('UPDATE feedback SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM user_groups WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/users/:id/approve', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { approved } = req.body;
    const result = await pool.query('UPDATE users SET approved = $1 WHERE id = $2 RETURNING *', [approved, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = mapUser(result.rows[0]);
    try {
      const groupResult = await pool.query(`
        SELECT g.id AS group_id, g.name AS group_name, g.color AS group_color
        FROM user_groups ug
        JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = $1
      `, [req.params.id]);
      user.groupIds = groupResult.rows.map(r => r.group_id);
      user.groupNames = groupResult.rows.map(r => r.group_name);
      user.groupColors = groupResult.rows.map(r => r.group_color);
    } catch (e) {
      user.groupIds = [];
      user.groupNames = [];
      user.groupColors = [];
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile update endpoint (any authenticated user can update their own profile)
app.put('/api/profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password, companyName, language } = req.body;
    const userId = req.user.id;
    let avatarPath = undefined;
    if (req.file) {
      avatarPath = `/uploads/${req.file.filename}`;
    }
    const lang = ['en', 'am'].includes(language) ? language : undefined;
    let query, params;
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      if (avatarPath) {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password = $3, company_name = COALESCE($4, company_name), language = COALESCE($5, language), avatar = $6 WHERE id = $7 RETURNING *';
        params = [name, email, hashedPassword, companyName || '', lang, avatarPath, userId];
      } else {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password = $3, company_name = COALESCE($4, company_name), language = COALESCE($5, language) WHERE id = $6 RETURNING *';
        params = [name, email, hashedPassword, companyName || '', lang, userId];
      }
    } else {
      if (avatarPath) {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), company_name = COALESCE($3, company_name), language = COALESCE($4, language), avatar = $5 WHERE id = $6 RETURNING *';
        params = [name, email, companyName || '', lang, avatarPath, userId];
      } else {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), company_name = COALESCE($3, company_name), language = COALESCE($4, language) WHERE id = $5 RETURNING *';
        params = [name, email, companyName || '', lang, userId];
      }
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = mapUser(result.rows[0]);
    try {
      const groupResult = await pool.query(`
        SELECT g.id AS group_id, g.name AS group_name, g.color AS group_color
        FROM user_groups ug
        JOIN groups g ON ug.group_id = g.id
        WHERE ug.user_id = $1
      `, [userId]);
      user.groupIds = groupResult.rows.map(r => r.group_id);
      user.groupNames = groupResult.rows.map(r => r.group_name);
      user.groupColors = groupResult.rows.map(r => r.group_color);
    } catch (e) {
      user.groupIds = [];
      user.groupNames = [];
      user.groupColors = [];
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Categories Routes
app.get('/api/categories', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/categories', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO categories (id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description, color || '#6B7280']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/categories/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color) WHERE id = $4 RETURNING *',
      [name, description, color, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/categories/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE requests SET category_id = NULL WHERE category_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Priorities Routes
app.get('/api/priorities', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM priorities ORDER BY level');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/priorities', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, color, level } = req.body;
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO priorities (id, name, color, level) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, color || '#6B7280', level || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Statuses Routes
app.get('/api/statuses', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM statuses ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Requests Routes
app.get('/api/requests', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT r.*, 
        u.name as client_name, u.email as client_email, u.role as client_role, u.avatar as client_avatar, u.created_at as client_created_at,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.color as priority_color, p.level as priority_level,
        s.name as status_name, s.color as status_color,
        a.name as assignee_name, a.email as assignee_email, a.role as assignee_role, a.avatar as assignee_avatar, a.created_at as assignee_created_at,
        ag.name as assigned_group_name, ag.color as assigned_group_color, ag.id as assigned_group_id,
        COALESCE(
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM request_groups rg JOIN groups g ON rg.group_id = g.id WHERE rg.request_id = r.id),
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM user_groups ug JOIN groups g ON ug.group_id = g.id WHERE ug.user_id = r.client_id),
          CASE WHEN u.group_id IS NOT NULL THEN (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM groups g WHERE g.id = u.group_id) ELSE NULL END
        ) as groups
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      LEFT JOIN statuses s ON r.status_id = s.id
      LEFT JOIN users a ON r.assigned_to = a.id
      LEFT JOIN groups ag ON r.assigned_group = ag.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'client') {
      query += ` AND r.client_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    if (req.user.role === 'developer' || req.user.role === 'support') {
      const myRequests = req.query.myRequests === 'true';
      if (myRequests) {
        query += ` AND r.assigned_to = $${paramIndex++}`;
        params.push(req.user.id);
      } else {
        query += ` AND (r.assigned_to = $${paramIndex++} OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $${paramIndex++})`;
        if (req.user.role === 'support') {
          query += ` OR r.status_id = '9'`;
        }
        query += `)`;
        params.push(req.user.id, req.user.id);
      }
    }

    const { status, priority, category, search } = req.query;
    if (status) {
      let statusId = status;
      if (isNaN(status)) {
        const row = await pool.query('SELECT id FROM statuses WHERE LOWER(name) = LOWER($1)', [status]);
        if (row.rows.length) statusId = row.rows[0].id;
      }
      query += ` AND r.status_id = $${paramIndex++}`;
      params.push(statusId);
    }
    if (priority) {
      query += ` AND r.priority_id = $${paramIndex++}`;
      params.push(priority);
    }
    if (category) {
      query += ` AND r.category_id = $${paramIndex++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (LOWER(r.subject) LIKE $${paramIndex} OR LOWER(r.id) LIKE $${paramIndex} OR LOWER(r.description) LIKE $${paramIndex})`;
      params.push(`%${search.toLowerCase()}%`);
      paramIndex++;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    const enriched = result.rows.map(r => ({
      id: r.id,
      subject: r.subject,
      description: r.description,
      clientId: r.client_id,
      categoryId: r.category_id,
      priorityId: r.priority_id,
      statusId: r.status_id,
      assignedTo: r.assigned_to,
      attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      client: r.client_name ? { id: r.client_id, name: r.client_name, email: r.client_email, role: r.client_role, avatar: r.client_avatar, createdAt: r.client_created_at } : null,
      category: r.category_name ? { id: r.category_id, name: r.category_name, description: r.category_description, color: r.category_color } : null,
      priority: r.priority_name ? { id: r.priority_id, name: r.priority_name, color: r.priority_color, level: r.priority_level } : null,
      status: r.status_name ? { id: r.status_id, name: r.status_name, color: r.status_color } : null,
assignee: r.assignee_name ? { id: r.assigned_to, name: r.assignee_name, email: r.assignee_email, role: r.assignee_role, avatar: r.assignee_avatar, createdAt: r.assignee_created_at } : null,
      assignedGroup: r.assigned_group_name ? { id: r.assigned_group_id, name: r.assigned_group_name, color: r.assigned_group_color } : null,
groups: r.groups ? (typeof r.groups === 'string' ? JSON.parse(r.groups) : r.groups) : []
    }));
    if (req.user.role === 'developer' || req.user.role === 'support') {
      const userGroupsRes = await pool.query('SELECT group_id FROM user_groups WHERE user_id = $1', [req.user.id]);
      const userGroupIds = userGroupsRes.rows.map(r => r.group_id);
      enriched.forEach(r => {
        r.groups = (r.groups || []).filter(g => userGroupIds.includes(g.id));
      });
    }
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Global search endpoint: server-side filtering, RBAC-scoped, paginated
app.get('/api/search', authMiddleware, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const type = req.query.type || 'all';
    const offset = (page - 1) * limit;
    const pattern = `%${q}%`;
    const role = req.user.role;

    const results = { requests: { total: 0, items: [] }, users: { total: 0, items: [] }, groups: { total: 0, items: [] } };

    if (!q) {
      return res.json({ q, page, limit, type, results });
    }

    // --- Requests: visible per role (admin: all, client: own, dev/support: assigned or group-based) ---
    if (type === 'all' || type === 'requests') {
      let visibility = '1=1';
      const visParams = [];
      if (role === 'client') {
        visibility = 'r.client_id = $1';
        visParams.push(req.user.id);
      } else if (role === 'developer' || role === 'support') {
        visibility = `(r.assigned_to = $${visParams.length + 1}
          OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $${visParams.length + 2})`;
        visParams.push(req.user.id, req.user.id);
        if (role === 'support') {
          visibility += ` OR r.status_id = '9'`;
        }
        visibility += ')';
      }

      const searchClause = `(
        r.id ILIKE $a OR r.subject ILIKE $a OR r.description ILIKE $a OR
        u.name ILIKE $a OR a.name ILIKE $a OR ag.name ILIKE $a OR
        c.name ILIKE $a OR s.name ILIKE $a OR p.name ILIKE $a OR
        EXISTS (SELECT 1 FROM request_groups rgs JOIN groups g2 ON rgs.group_id = g2.id WHERE rgs.request_id = r.id AND g2.name ILIKE $a)
      )`;

      const base = `
        FROM requests r
        LEFT JOIN users u ON r.client_id = u.id
        LEFT JOIN users a ON r.assigned_to = a.id
        LEFT JOIN groups ag ON r.assigned_group = ag.id
        LEFT JOIN categories c ON r.category_id = c.id
        LEFT JOIN statuses s ON r.status_id = s.id
        LEFT JOIN priorities p ON r.priority_id = p.id
        WHERE ${visibility} AND ${searchClause}
      `;

      const searchIndex = visParams.length + 1;
      const countParams = [...visParams, pattern];
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total ${base}`.replaceAll('$a', `$${searchIndex}`),
        countParams
      );

      const itemsParams = [...visParams, pattern, limit, offset];
      const itemsResult = await pool.query(`
        SELECT r.id, r.subject, r.description, r.created_at,
          u.name AS client_name,
          a.name AS assignee_name,
          ag.name AS assigned_group_name, ag.color AS assigned_group_color,
          c.name AS category_name, c.color AS category_color,
          s.name AS status_name, s.color AS status_color,
          p.name AS priority_name, p.color AS priority_color
        ${base}
        ORDER BY r.created_at DESC LIMIT $${searchIndex + 1} OFFSET $${searchIndex + 2}
      `.replaceAll('$a', `$${searchIndex}`), itemsParams);

      results.requests = { total: countResult.rows[0].total, items: itemsResult.rows };
    }

    // --- Users: admin only ---
    if ((type === 'all' || type === 'users') && role === 'admin') {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM users u
         WHERE u.id ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1 OR u.role ILIKE $1 OR u.company_name ILIKE $1`,
        [pattern]
      );
      const itemsResult = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.avatar, u.company_name
         FROM users u
         WHERE u.id ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1 OR u.role ILIKE $1 OR u.company_name ILIKE $1
         ORDER BY u.name LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      );
      results.users = { total: countResult.rows[0].total, items: itemsResult.rows };
    }

    // --- Groups: admin only ---
    if ((type === 'all' || type === 'groups') && role === 'admin') {
      const countResult = await pool.query(
        `SELECT COUNT(*)::int AS total FROM groups g
         LEFT JOIN companies c ON c.id = g.company_id
         WHERE g.id ILIKE $1 OR g.name ILIKE $1 OR g.description ILIKE $1 OR c.name ILIKE $1`,
        [pattern]
      );
      const itemsResult = await pool.query(
        `SELECT g.id, g.name, g.description, g.color, c.name AS company_name,
          (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) AS "memberCount"
         FROM groups g
         LEFT JOIN companies c ON c.id = g.company_id
         WHERE g.id ILIKE $1 OR g.name ILIKE $1 OR g.description ILIKE $1 OR c.name ILIKE $1
         ORDER BY g.name LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      );
      results.groups = { total: countResult.rows[0].total, items: itemsResult.rows };
    }

    res.json({ q, page, limit, type, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        u.name as client_name, u.email as client_email, u.role as client_role, u.avatar as client_avatar, u.created_at as client_created_at,
        c.name as category_name, c.description as category_description, c.color as category_color,
        p.name as priority_name, p.color as priority_color, p.level as priority_level,
        s.name as status_name, s.color as status_color,
        a.name as assignee_name, a.email as assignee_email, a.role as assignee_role, a.avatar as assignee_avatar, a.created_at as assignee_created_at,
        ag.name as assigned_group_name, ag.color as assigned_group_color, ag.id as assigned_group_id,
        COALESCE(
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM request_groups rg JOIN groups g ON rg.group_id = g.id WHERE rg.request_id = r.id),
          (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM user_groups ug JOIN groups g ON ug.group_id = g.id WHERE ug.user_id = r.client_id),
          CASE WHEN u.group_id IS NOT NULL THEN (SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color)) FROM groups g WHERE g.id = u.group_id) ELSE NULL END
        ) as groups
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      LEFT JOIN statuses s ON r.status_id = s.id
      LEFT JOIN users a ON r.assigned_to = a.id
      LEFT JOIN groups ag ON r.assigned_group = ag.id
      WHERE r.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const r = result.rows[0];

    if (req.user.role === 'client' && r.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'client' && r.assigned_to !== req.user.id) {
      const isEscalated = r.status_id === '9';
      if (!(req.user.role === 'support' && isEscalated)) {
        const groupAccess = await pool.query(
          'SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = $1 AND ug.user_id = $2 LIMIT 1',
          [req.params.id, req.user.id]
        );
        if (groupAccess.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
    }

    const commentsResult = await pool.query(`
      SELECT cm.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar, u.created_at as user_created_at
      FROM comments cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.request_id = $1
      ORDER BY cm.created_at ASC
    `, [req.params.id]);

    const enriched = {
      id: r.id,
      subject: r.subject,
      description: r.description,
      clientId: r.client_id,
      categoryId: r.category_id,
      priorityId: r.priority_id,
      statusId: r.status_id,
      assignedTo: r.assigned_to,
      attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      client: r.client_name ? { id: r.client_id, name: r.client_name, email: r.client_email, role: r.client_role, avatar: r.client_avatar, createdAt: r.client_created_at } : null,
      category: r.category_name ? { id: r.category_id, name: r.category_name, description: r.category_description, color: r.category_color } : null,
      priority: r.priority_name ? { id: r.priority_id, name: r.priority_name, color: r.priority_color, level: r.priority_level } : null,
      status: r.status_name ? { id: r.status_id, name: r.status_name, color: r.status_color } : null,
      assignee: r.assignee_name ? { id: r.assigned_to, name: r.assignee_name, email: r.assignee_email, role: r.assignee_role, avatar: r.assignee_avatar, createdAt: r.assignee_created_at } : null,
      assignedGroup: r.assigned_group_name ? { id: r.assigned_group_id, name: r.assigned_group_name, color: r.assigned_group_color } : null,
      groups: r.groups ? (typeof r.groups === 'string' ? JSON.parse(r.groups) : r.groups) : [],
      comments: commentsResult.rows.map(c => ({
        id: c.id,
        requestId: c.request_id,
        userId: c.user_id,
        content: c.content,
        createdAt: c.created_at,
        attachments: typeof c.attachments === 'string' ? JSON.parse(c.attachments) : (c.attachments || []),
        user: c.user_name ? { id: c.user_id, name: c.user_name, email: c.user_email, role: c.user_role, avatar: c.user_avatar, createdAt: c.user_created_at } : null
      }))
    };
    if (req.user.role === 'developer' || req.user.role === 'support') {
      const userGroupsRes = await pool.query(
        `SELECT g.id, g.name, g.color FROM user_groups ug JOIN groups g ON ug.group_id = g.id WHERE ug.user_id = $1`,
        [req.user.id]
      );
      enriched.groups = userGroupsRes.rows;
    }
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, attachments } = req.body;
    if (!subject || !subject.trim() || !description || !description.trim() || !categoryId) {
      return res.status(400).json({ error: 'Please fill all required fields' });
    }
    const countResult = await pool.query("SELECT nextval('requests_id_seq') AS next_num");
    const nextNum = parseInt(countResult.rows[0].next_num);
    const id = `REQ-2024-${String(nextNum).padStart(5, '0')}`;
    const clientId = req.user.role === 'client' ? req.user.id : req.body.clientId;
    const now = new Date().toISOString();

    const defResult = await pool.query("SELECT value FROM system_settings WHERE key IN ('defaultStatus', 'defaultPriority')");
    const defMap = {};
    for (const row of defResult.rows) defMap[row.key] = row.value;
    const defaultStatusId = defMap.defaultStatus || '1';
    const defaultPriorityId = defMap.defaultPriority || '2';

    await pool.query(
      'INSERT INTO requests (id, subject, description, client_id, category_id, priority_id, status_id, attachments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, subject, description, clientId, categoryId, priorityId || defaultPriorityId, defaultStatusId, JSON.stringify(attachments || []), now, now]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'created', id, req.user.id, 'New request created', now]
    );

    // Store client's groups for group-based visibility
    const clientGroups = await pool.query('SELECT group_id FROM user_groups WHERE user_id = $1', [clientId]);
    if (clientGroups.rows.length > 0) {
      const groupValues = clientGroups.rows.map(r => `('${id}', '${r.group_id}')`).join(',');
      await pool.query(`INSERT INTO request_groups (request_id, group_id) VALUES ${groupValues} ON CONFLICT DO NOTHING`);
    }

    // Real-time notification
    notifyAdmins('New request created', { type: 'request_created', requestId: id, subject, userId: req.user.id, userName: req.user.name });

    res.status(201).json({ id, subject, description, clientId, categoryId, priorityId: priorityId || '2', statusId: '1', assignedTo: null, attachments: attachments || [], createdAt: now, updatedAt: now });
  } catch (err) {
    console.error('Create request error:', err.message);
    res.status(500).json({ error: 'Failed to create request: ' + err.message });
  }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, statusId, assignedTo, assignedGroup, attachments } = req.body;
    const now = new Date().toISOString();

    const existing = await pool.query('SELECT * FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // Check group-based access for non-admin users
    if (req.user.role !== 'admin') {
      if (req.user.role === 'client' && existing.rows[0].client_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (req.user.role !== 'client') {
        const isAssignedToUser = existing.rows[0].assigned_to === req.user.id;
        const isUnassigned = existing.rows[0].assigned_to === null;
        // Developers can only modify requests assigned to them personally
        if (req.user.role === 'developer' && !isAssignedToUser) {
          return res.status(403).json({ error: 'Access denied - you can only modify requests assigned to you' });
        }
        // Support/escalation members assigned to a request have full permission to
        // modify it. Otherwise they can modify any escalated request; New requests
        // they are not assigned to stay read-only.
        if (req.user.role === 'support') {
          if (isAssignedToUser) {
            // assigned escalation member: full permission
          } else if (existing.rows[0].status_id === '1') {
            return res.status(403).json({ error: 'Access denied - new requests cannot be modified by the escalation team' });
          } else if (existing.rows[0].status_id !== '9') {
            return res.status(403).json({ error: 'Access denied - you can only modify requests assigned to you' });
          }
        } else {
          if (!isAssignedToUser && !isUnassigned) {
            return res.status(403).json({ error: 'Access denied - request assigned to another user' });
          }
          // For unassigned requests, verify group access
          if (isUnassigned) {
          const groupAccess = await pool.query(
            'SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = $1 AND ug.user_id = $2 LIMIT 1',
            [req.params.id, req.user.id]
          );
          if (groupAccess.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
}
    }
    }
      }
    }

    // Check allowReopen setting
    if (statusId) {
      const reopenResult = await pool.query("SELECT value FROM system_settings WHERE key = 'allowReopen'");
      const allowReopen = reopenResult.rows.length > 0 ? reopenResult.rows[0].value === 'true' : true;
      const closedStatusIds = ['5', '6', '8'];
      if (closedStatusIds.includes(existing.rows[0].status_id) && closedStatusIds.includes(statusId)) {
        if (!allowReopen && req.user.role === 'client') {
          return res.status(403).json({ error: 'Reopening requests is not allowed. Contact an administrator.' });
        }
      }
      // Clients can only close or reject a resolved request
      if (req.user.role === 'client' && (statusId === '6' || statusId === '8') && existing.rows[0].status_id !== '5') {
        return res.status(400).json({ error: 'You can only close or reject a request that is in Resolved status.' });
      }
      // Developers must claim and assign a new request to themselves before changing its status
      if (req.user.role === 'developer' && existing.rows[0].status_id === '1' && statusId) {
        return res.status(403).json({ error: 'You must claim and assign this request to yourself before changing its status' });
      }
    }

    let newStatusId = existing.rows[0].status_id;
    let newAssignedTo = existing.rows[0].assigned_to;

    if (statusId) newStatusId = statusId;
    if (assignedTo !== undefined) newAssignedTo = assignedTo || null;

    if (statusId && newStatusId === '1') {
      newAssignedTo = null;
    } else if (assignedTo && assignedTo !== existing.rows[0].assigned_to) {
      if (existing.rows[0].status_id !== '9') {
        newStatusId = '2';
      }
    } else if (req.user.role === 'support' && existing.rows[0].status_id === '9' && newAssignedTo !== req.user.id) {
      newAssignedTo = req.user.id;
    }

    const newAttachments = attachments !== undefined ? attachments : (typeof existing.rows[0].attachments === 'string' ? JSON.parse(existing.rows[0].attachments) : existing.rows[0].attachments);

    await pool.query(
      'UPDATE requests SET subject = COALESCE($1, subject), description = COALESCE($2, description), category_id = COALESCE($3, category_id), priority_id = COALESCE($4, priority_id), status_id = $5, assigned_to = $6, attachments = $7, updated_at = $8, assigned_group = COALESCE($10, assigned_group) WHERE id = $9',
      [subject, description, categoryId, priorityId, newStatusId, newAssignedTo, JSON.stringify(newAttachments), now, req.params.id, assignedGroup || null]
    );

    // Sync request_groups when assignedGroup changes
    if (assignedGroup) {
      await pool.query('DELETE FROM request_groups WHERE request_id = $1', [req.params.id]);
      await pool.query('INSERT INTO request_groups (request_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, assignedGroup]);
    }

    const notifResult = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('notifyClientStatusChange', 'notifyDeveloperAssignment', 'emailNotifications', 'inAppNotifications')");
    const notifSettings = {};
    for (const row of notifResult.rows) {
      notifSettings[row.key] = row.value === 'true';
    }

    if (statusId && statusId !== existing.rows[0].status_id) {
      const [statusResult, oldStatusResult] = await Promise.all([
        pool.query('SELECT name FROM statuses WHERE id = $1', [statusId]),
        pool.query('SELECT name FROM statuses WHERE id = $1', [existing.rows[0].status_id])
      ]);
      const newStatusName = statusResult.rows[0]?.name || 'Unknown';
      const oldStatusName = oldStatusResult.rows[0]?.name || 'Unknown';
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'status_update', req.params.id, req.user.id, `Changed status from ${oldStatusName} to ${newStatusName}`, now]
      );
      const statusName = newStatusName;
      const clientId = existing.rows[0].client_id;
      notifyAdmins(`Request #${req.params.id} status changed to ${statusName}`, { type: 'status_change', requestId: req.params.id, status: statusName, userId: req.user.id, userName: req.user.name });
      if (clientId && clientId !== req.user.id && notifSettings.notifyClientStatusChange !== false) {
        notifyUser(clientId, `Your request #${req.params.id} status changed to ${statusName}`, { type: 'status_change', requestId: req.params.id, status: statusName, userId: req.user.id, userName: req.user.name });
      }
    }

    if (assignedTo && assignedTo !== existing.rows[0].assigned_to) {
      const assigneeResult = await pool.query('SELECT name FROM users WHERE id = $1', [assignedTo]);
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'assigned', req.params.id, req.user.id, `Assigned to ${assigneeResult.rows[0]?.name || 'Unknown'}`, now]
      );
      const assigneeName = assigneeResult.rows[0]?.name || 'Unknown';
      const clientId = existing.rows[0].client_id;
      notifyAdmins(`Request #${req.params.id} assigned to ${assigneeName}`, { type: 'assigned', requestId: req.params.id, assignee: assigneeName, userId: req.user.id, userName: req.user.name });
      if (notifSettings.notifyDeveloperAssignment !== false) {
        notifyUser(assignedTo, `You have been assigned to Request #${req.params.id}`, { type: 'assigned', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
      }
      if (clientId && clientId !== req.user.id) {
        notifyUser(clientId, `Your request #${req.params.id} has been assigned to ${assigneeName}`, { type: 'assigned', requestId: req.params.id, assignee: assigneeName, userId: req.user.id, userName: req.user.name });
      }
    }

    res.json({ id: req.params.id, subject: subject || existing.rows[0].subject, description: description || existing.rows[0].description, clientId: existing.rows[0].client_id, categoryId: categoryId || existing.rows[0].category_id, priorityId: priorityId || existing.rows[0].priority_id, statusId: newStatusId, assignedTo: newAssignedTo, assignedGroup: assignedGroup || existing.rows[0].assigned_group, attachments: newAttachments, createdAt: existing.rows[0].created_at, updatedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/requests/:id/claim', authMiddleware, async (req, res) => {
  try {
    const requestId = req.params.id;
    const existing = await pool.query('SELECT * FROM requests WHERE id = $1', [requestId]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    if (existing.rows[0].assigned_to && req.user.role !== 'support') {
      return res.status(400).json({ error: 'Request is already assigned to another user' });
    }

    if (req.user.role === 'client') {
      return res.status(403).json({ error: 'Clients cannot claim requests' });
    }

    if (req.user.role === 'support') {
      if (existing.rows[0].status_id !== '9') {
        return res.status(403).json({ error: 'Escalation team can only claim escalated requests' });
      }
    }

    if (req.user.role !== 'support') {
      const groupAccess = await pool.query(
        'SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = $1 AND ug.user_id = $2 LIMIT 1',
        [requestId, req.user.id]
      );
      if (groupAccess.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied - you are not a member of a group assigned to this request' });
      }
    }

    const now = new Date().toISOString();
    const assignedStatus = req.user.role === 'support' ? '9' : '2';

    await pool.query(
      'UPDATE requests SET assigned_to = $1, status_id = $2, updated_at = $3 WHERE id = $4',
      [req.user.id, assignedStatus, now, requestId]
    );

    const assigneeResult = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const assigneeName = assigneeResult.rows[0]?.name || 'Unknown';

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'assigned', requestId, req.user.id, `Claimed by ${assigneeName}`, now]
    );

    const notifResult = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('notifyClientStatusChange', 'notifyDeveloperAssignment', 'emailNotifications', 'inAppNotifications')");
    const notifSettings = {};
    for (const row of notifResult.rows) {
      notifSettings[row.key] = row.value === 'true';
    }

    notifyAdmins(`Request #${requestId} claimed by ${assigneeName}`, { type: 'claimed', requestId, assignee: req.user.id, userId: req.user.id, userName: req.user.name });

    const clientId = existing.rows[0].client_id;
    if (clientId && clientId !== req.user.id && notifSettings.notifyClientStatusChange !== false) {
      notifyUser(clientId, `Your request #${requestId} has been claimed and is being worked on`, { type: 'claimed', requestId, userId: req.user.id, userName: req.user.name });
    }

    const statusResult = await pool.query('SELECT name FROM statuses WHERE id = $1', [assignedStatus]);
    res.json({
      id: requestId,
      assignedTo: req.user.id,
      assignee: { id: req.user.id, name: assigneeName },
      statusId: assignedStatus,
      status: statusResult.rows[0] || { id: assignedStatus, name: 'Assigned' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/requests/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    await pool.query('DELETE FROM comments WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM activity_log WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM feedback WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
    // Real-time notification
    notifyAdmins(`Request #${req.params.id} deleted`, { type: 'request_deleted', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Comments Routes
app.post('/api/requests/:id/comments', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, client_id, assigned_to, status_id FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // Check group access for non-admin, non-client, non-assignee users
    const isEscalated = existing.rows[0].status_id === '9';
    if (req.user.role !== 'admin' && req.user.role !== 'client' && existing.rows[0].client_id !== req.user.id && existing.rows[0].assigned_to !== req.user.id) {
      if (!(req.user.role === 'support' && isEscalated)) {
        const groupAccess = await pool.query(
          'SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = $1 AND ug.user_id = $2 LIMIT 1',
          [req.params.id, req.user.id]
        );
        if (groupAccess.rows.length === 0) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
    }

    const { content, attachments } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    await pool.query(
      'INSERT INTO comments (id, request_id, user_id, content, attachments, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.params.id, req.user.id, content, JSON.stringify(attachments || []), now]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'comment', req.params.id, req.user.id, 'New comment on request', now]
    );

    // Real-time notification
    const clientId = existing.rows[0].client_id;
    notifyAdmins(`New comment on Request #${req.params.id} by ${req.user.name}`, { type: 'comment', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
    // Notify the client (if comment is not from the client)
    if (clientId && clientId !== req.user.id) {
      notifyUser(clientId, `New comment on your request #${req.params.id} by ${req.user.name}`, { type: 'comment', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
    }

    res.status(201).json({ id, requestId: req.params.id, userId: req.user.id, content, createdAt: now, user: mapUser(req.user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Feedback Routes
app.get('/api/requests/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT f.*, u.name AS user_name FROM feedback f LEFT JOIN users u ON f.user_id = u.id WHERE f.request_id = $1',
      [req.params.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/requests/:id/feedback', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
    const existing = await pool.query('SELECT id FROM feedback WHERE request_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (existing.rows.length > 0) {
      await pool.query('UPDATE feedback SET rating = $1, comment = $2 WHERE request_id = $3 AND user_id = $4', [rating, comment || '', req.params.id, req.user.id]);
    } else {
      const id = uuidv4();
      await pool.query('INSERT INTO feedback (id, request_id, user_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [id, req.params.id, req.user.id, rating, comment || '']);
    }
    res.status(201).json({ rating, comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/feedback', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.name AS user_name, r.subject AS request_subject
       FROM feedback f
       LEFT JOIN users u ON f.user_id = u.id
       LEFT JOIN requests r ON f.request_id = r.id
       ORDER BY f.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/feedback/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM feedback WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Feedback not found' });
    await pool.query('DELETE FROM feedback WHERE id = $1', [req.params.id]);
    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload Route
app.post('/api/upload', authMiddleware, async (req, res, next) => {
  try {
    const sizeResult = await pool.query("SELECT value FROM system_settings WHERE key = 'maxUploadSize'");
    const maxMB = sizeResult.rows.length > 0 ? parseInt(sizeResult.rows[0].value) || 10 : 10;
    const maxBytes = maxMB * 1024 * 1024;
    const m = multer({ storage, limits: { fileSize: maxBytes } });
    m.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `File too large. Maximum size is ${maxMB}MB` });
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'client') {
      whereClause += ` AND r.client_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    if (req.user.role === 'developer' || req.user.role === 'support') {
      const myRequests = req.query.myRequests === 'true';
      if (myRequests) {
        whereClause += ` AND r.assigned_to = $${paramIndex++}`;
        params.push(req.user.id);
      } else {
        whereClause += ` AND (r.assigned_to = $${paramIndex++} OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $${paramIndex++})`;
        if (req.user.role === 'support') {
          whereClause += ` OR r.status_id = '9'`;
        }
        whereClause += `)`;
        params.push(req.user.id, req.user.id);
      }
    }

    const totalResult = await pool.query(`SELECT COUNT(*) FROM requests r ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0].count);

    const statusCounts = await pool.query(
      `SELECT r.status_id, COUNT(*) as count FROM requests r ${whereClause} GROUP BY r.status_id`, params
    );
    const statusMap = {};
    statusCounts.rows.forEach(row => { statusMap[row.status_id] = parseInt(row.count); });

    const open = statusMap['1'] || 0;
    const inProgress = statusMap['3'] || 0;
    const waiting = statusMap['4'] || 0;
    const resolved = statusMap['5'] || 0;
    const closed = statusMap['6'] || 0;
    const escalated = statusMap['9'] || 0;
    const rejected = statusMap['8'] || 0;

    const statusesResult = await pool.query('SELECT * FROM statuses ORDER BY id');
    const statuses = statusesResult.rows;
    const byStatus = statuses.map(s => ({
      ...s,
      count: statusMap[s.id] || 0,
      percentage: total > 0 ? (((statusMap[s.id] || 0) / total) * 100).toFixed(1) : 0
    }));

    const priorityCounts = await pool.query(
      `SELECT r.priority_id, COUNT(*) as count FROM requests r ${whereClause} GROUP BY r.priority_id`, params
    );
    const priorityMap = {};
    priorityCounts.rows.forEach(row => { priorityMap[row.priority_id] = parseInt(row.count); });

    const prioritiesResult = await pool.query('SELECT * FROM priorities ORDER BY level');
    const priorities = prioritiesResult.rows;
    const byPriority = priorities.map(p => ({
      ...p,
      count: priorityMap[p.id] || 0,
      percentage: total > 0 ? (((priorityMap[p.id] || 0) / total) * 100).toFixed(1) : 0
    }));

    const categoryCounts = await pool.query(
      `SELECT r.category_id, COUNT(*) as count FROM requests r ${whereClause} GROUP BY r.category_id`, params
    );
    const categoryMap = {};
    categoryCounts.rows.forEach(row => { categoryMap[row.category_id] = parseInt(row.count); });

    const categoriesResult = await pool.query('SELECT * FROM categories ORDER BY name');
    const categories = categoriesResult.rows;
    const byCategory = categories.map(c => ({
      ...c,
      count: categoryMap[c.id] || 0
    }));

    const companyCounts = await pool.query(
      `SELECT COALESCE(NULLIF(u.company_name, ''), 'Unknown') as name, COUNT(*) as count FROM requests r LEFT JOIN users u ON r.client_id = u.id ${whereClause} GROUP BY u.company_name ORDER BY count DESC`, params
    );
    const byCompany = companyCounts.rows.map(r => ({ ...r, count: parseInt(r.count) }));

    const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayParams = [...params];
      let dayQuery = `SELECT COUNT(*) FROM requests r ${whereClause} AND r.created_at::date = $${paramIndex}`;
      dayParams.push(dateStr);
      const createdResult = await pool.query(dayQuery, dayParams);

      const resolvedResult = await pool.query(
        `SELECT COUNT(*) FROM requests r ${whereClause} AND r.status_id = '5' AND r.updated_at::date = $${paramIndex}`,
        dayParams
      );
      const closedResult = await pool.query(
        `SELECT COUNT(*) FROM requests r ${whereClause} AND r.status_id = '6' AND r.updated_at::date = $${paramIndex}`,
        dayParams
      );

      dailyData.push({
        date: dayName,
        created: parseInt(createdResult.rows[0].count),
        resolved: parseInt(resolvedResult.rows[0].count),
        closed: parseInt(closedResult.rows[0].count)
      });
    }

    res.json({
      total,
      open,
      inProgress,
      waiting,
      resolved,
      closed,
      escalated,
      rejected,
      byStatus,
      byPriority,
      byCategory,
      byCompany,
      dailyData,
      totalLastWeek: Math.floor(total * 0.88),
      openLastWeek: Math.floor(open * 0.92),
      inProgressLastWeek: Math.floor(inProgress * 0.95),
      waitingLastWeek: Math.floor(waiting * 0.9),
      resolvedLastWeek: Math.floor(resolved * 0.85),
      closedLastWeek: Math.floor(closed * 1.05),
      escalatedLastWeek: Math.floor(escalated * 0.9),
      rejectedLastWeek: Math.floor(rejected * 0.9)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Performance by Company and Developer
app.get('/api/dashboard/performance', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const labels = [];
    const dates = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    const byCompanyResult = await pool.query(`
      SELECT u.company_name,
        r.created_at::date AS day,
        COUNT(*) AS created,
        COUNT(CASE WHEN s.name = 'Resolved' OR s.name = 'Closed' THEN 1 END) AS resolved
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE r.created_at::date >= ($1::date - INTERVAL '1 day' * $2)
        AND u.company_name IS NOT NULL AND u.company_name != ''
      GROUP BY u.company_name, r.created_at::date
      ORDER BY u.company_name, r.created_at::date
    `, [dates[dates.length - 1], days]);

    const companyMap = {};
    byCompanyResult.rows.forEach(row => {
      if (!companyMap[row.company_name]) {
        companyMap[row.company_name] = {};
      }
      companyMap[row.company_name][row.day] = { created: parseInt(row.created), resolved: parseInt(row.resolved) };
    });
    const byCompany = Object.entries(companyMap).map(([name, dayData]) => ({
      name,
      data: dates.map((d, i) => ({ date: labels[i], created: dayData[d]?.created || 0, resolved: dayData[d]?.resolved || 0 }))
    }));

    const companyStatusResult = await pool.query(`
      SELECT u.company_name, s.name AS status_name, COUNT(*)::int AS count
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE r.created_at::date >= ($1::date - INTERVAL '1 day' * $2)
        AND u.company_name IS NOT NULL AND u.company_name != ''
      GROUP BY u.company_name, s.name
      ORDER BY u.company_name, s.name
    `, [dates[dates.length - 1], days]);

    const companyStatusMap = {};
    companyStatusResult.rows.forEach(row => {
      if (!companyStatusMap[row.company_name]) {
        companyStatusMap[row.company_name] = {};
      }
      companyStatusMap[row.company_name][row.status_name] = row.count;
    });
    const companyStats = Object.entries(companyStatusMap).map(([name, statuses]) => ({
      name,
      ...statuses
    }));

    const byDeveloperResult = await pool.query(`
      SELECT u.id, u.name AS developer_name,
        r.created_at::date AS day,
        COUNT(*) AS created,
        COUNT(CASE WHEN s.name = 'Resolved' OR s.name = 'Closed' THEN 1 END) AS resolved
      FROM requests r
      LEFT JOIN users u ON r.assigned_to = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE r.created_at::date >= ($1::date - INTERVAL '1 day' * $2)
        AND u.role IN ('developer', 'support')
      GROUP BY u.id, u.name, r.created_at::date
      ORDER BY u.name, r.created_at::date
    `, [dates[dates.length - 1], days]);

    const devMap = {};
    byDeveloperResult.rows.forEach(row => {
      if (!devMap[row.developer_name]) {
        devMap[row.developer_name] = {};
      }
      devMap[row.developer_name][row.day] = { created: parseInt(row.created), resolved: parseInt(row.resolved) };
    });
    const byDeveloper = Object.entries(devMap).map(([name, dayData]) => ({
      name,
      data: dates.map((d, i) => ({ date: labels[i], created: dayData[d]?.created || 0, resolved: dayData[d]?.resolved || 0 }))
    }));

    const devStatusResult = await pool.query(`
      SELECT u.name AS developer_name, s.name AS status_name, COUNT(*)::int AS count
      FROM requests r
      LEFT JOIN users u ON r.assigned_to = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE r.created_at::date >= ($1::date - INTERVAL '1 day' * $2)
        AND u.role IN ('developer', 'support')
      GROUP BY u.name, s.name
      ORDER BY u.name, s.name
    `, [dates[dates.length - 1], days]);

    const devStatusMap = {};
    devStatusResult.rows.forEach(row => {
      if (!devStatusMap[row.developer_name]) {
        devStatusMap[row.developer_name] = {};
      }
      devStatusMap[row.developer_name][row.status_name] = row.count;
    });
    const developerStats = Object.entries(devStatusMap).map(([name, statuses]) => ({
      name,
      ...statuses
    }));

    res.json({ labels, byCompany, byDeveloper, companyStats, developerStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Activity Log
app.get('/api/activity', authMiddleware, async (req, res) => {
  try {
    let query = `
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar, u.created_at as user_created_at,
        r.subject as request_subject
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN requests r ON al.request_id = r.id
    `;
    const params = [];
    if (req.user.role === 'client') {
      query += ` WHERE r.client_id = $1`;
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      query += ` WHERE (r.assigned_to = $1 OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $1)`;
      if (req.user.role === 'support') {
        query += ` OR r.status_id = '9'`;
      }
      query += `)`;
      params.push(req.user.id);
    }
    query += ' ORDER BY al.created_at DESC LIMIT 20';
    const result = await pool.query(query, params);
    const enriched = result.rows.map(a => ({
      id: a.id,
      type: a.type,
      requestId: a.request_id,
      userId: a.user_id,
      message: a.message,
      createdAt: a.created_at,
      user: a.user_name ? { id: a.user_id, name: a.user_name, email: a.user_email, role: a.user_role, avatar: a.user_avatar, createdAt: a.user_created_at } : null,
      request: a.request_subject ? { id: a.request_id, subject: a.request_subject } : null
    }));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Activity log for a specific request
app.delete('/api/requests/:id/activity', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const ownership = await pool.query('SELECT id FROM requests WHERE id = $1 AND client_id = $2', [req.params.id, req.user.id]);
      if (ownership.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }
    await pool.query('DELETE FROM activity_log WHERE request_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear activity log' });
  }
});

app.delete('/api/activity', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM activity_log');
    res.json({ success: true, message: 'All activity cleared' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear activity log' });
  }
});

app.get('/api/requests/:id/activity', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const ownership = await pool.query('SELECT id FROM requests WHERE id = $1 AND client_id = $2', [req.params.id, req.user.id]);
      if (ownership.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    } else if (req.user.role !== 'admin') {
      const access = await pool.query(
        'SELECT r.assigned_to FROM requests r LEFT JOIN request_groups rg ON r.id = rg.request_id LEFT JOIN user_groups ug ON rg.group_id = ug.group_id AND ug.user_id = $2 WHERE r.id = $1 AND (r.assigned_to = $2 OR ug.user_id IS NOT NULL) LIMIT 1',
        [req.params.id, req.user.id]
      );
      if (access.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
    }
    const result = await pool.query(`
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.request_id = $1
      ORDER BY al.created_at DESC
    `, [req.params.id]);
    const enriched = result.rows.map(a => ({
      id: a.id,
      type: a.type,
      requestId: a.request_id,
      userId: a.user_id,
      message: a.message,
      createdAt: a.created_at,
      user: a.user_name ? { id: a.user_id, name: a.user_name, email: a.user_email, role: a.user_role, avatar: a.user_avatar } : null
    }));
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reports
app.get('/api/reports/summary', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const totalResult = await pool.query('SELECT COUNT(*) FROM requests');
    const total = parseInt(totalResult.rows[0].count);

    const byStatusResult = await pool.query(`
      SELECT s.name, COUNT(r.id) as count FROM statuses s
      LEFT JOIN requests r ON r.status_id = s.id
      GROUP BY s.name, s.id ORDER BY s.id
    `);
    const byPriorityResult = await pool.query(`
      SELECT p.name, COUNT(r.id) as count FROM priorities p
      LEFT JOIN requests r ON r.priority_id = p.id
      GROUP BY p.name, p.id ORDER BY p.id
    `);
    const byCategoryResult = await pool.query(`
      SELECT c.name, COUNT(r.id) as count FROM categories c
      LEFT JOIN requests r ON r.category_id = c.id
      GROUP BY c.name, c.id ORDER BY c.name
    `);

    const byCompanyResult = await pool.query(`
      SELECT COALESCE(NULLIF(u.company_name, ''), 'Unknown') as name, COUNT(r.id) as count FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      GROUP BY u.company_name ORDER BY count DESC
    `);

    const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
    const activeUsersResult = await pool.query("SELECT COUNT(*) FROM users WHERE role != 'admin'");

    const newTasksResult = await pool.query(`
      SELECT r.id, r.subject, r.created_at, u.name AS client_name, c.name AS category_name, p.name AS priority_name
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      ORDER BY r.created_at DESC LIMIT 10
    `);

    const userPerformanceResult = await pool.query(`
      SELECT u.id, u.name, u.role,
        COUNT(r.id) AS total_assigned,
        COUNT(CASE WHEN s.name = 'Resolved' OR s.name = 'Closed' THEN 1 END) AS resolved,
        COUNT(CASE WHEN s.name = 'In Progress' THEN 1 END) AS in_progress,
        COUNT(CASE WHEN s.name = 'New' OR s.name = 'Assigned' THEN 1 END) AS pending
      FROM users u
      LEFT JOIN requests r ON r.assigned_to = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE u.role IN ('developer', 'support')
      GROUP BY u.id, u.name, u.role
      ORDER BY resolved DESC
    `);

    res.json({
      total,
      byStatus: byStatusResult.rows,
      byPriority: byPriorityResult.rows,
      byCategory: byCategoryResult.rows,
      byCompany: byCompanyResult.rows,
      avgResolutionTime: '2.5 days',
      clientSatisfaction: '87%',
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      activeUsers: parseInt(activeUsersResult.rows[0].count),
      newTasks: newTasksResult.rows,
      userPerformance: userPerformanceResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Roles
app.get('/api/roles', authMiddleware, roleMiddleware('admin'), (req, res) => {
  res.json([
    { id: 'admin', name: 'Administrator', permissions: ['all'] },
    { id: 'support', name: 'Escalation Team', permissions: ['manage_requests', 'assign', 'comment', 'view_all'] },
    { id: 'developer', name: 'Developer', permissions: ['update_status', 'comment', 'view_assigned'] },
    { id: 'client', name: 'Client', permissions: ['create_request', 'comment', 'view_own'] }
  ]);
});

// Groups Routes
app.get('/api/groups', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, c.name as company_name,
        (SELECT COUNT(*) FROM user_groups ug WHERE ug.group_id = g.id) as "memberCount"
      FROM groups g
      LEFT JOIN companies c ON c.id = g.company_id
      ORDER BY g.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/groups', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color, company_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO groups (id, name, description, color, company_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, name, description || '', color || '#6B7280', company_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/groups/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color, company_id } = req.body;
    const result = await pool.query(
      'UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color), company_id = $4 WHERE id = $5 RETURNING *',
      [name, description, color, company_id ?? null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Group not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/groups/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM user_groups WHERE group_id = $1', [req.params.id]);
    await pool.query('UPDATE users SET group_id = NULL WHERE group_id = $1', [req.params.id]);
    await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Group Members Routes
app.get('/api/groups/:id/members', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.approved
      FROM user_groups ug
      JOIN users u ON u.id = ug.user_id
      WHERE ug.group_id = $1
      ORDER BY u.name
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/groups/:id/members', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'User ID is required' });
    await pool.query(
      'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [user_id, req.params.id]
    );
    // Associate the user's previously submitted requests with this group so
    // they become visible to the group's developers/escalation members
    const synced = await addUserRequestGroup(user_id, req.params.id);
    if (synced > 0) {
      notifyGroupMembers(req.params.id, `${synced} new request${synced > 1 ? 's' : ''} available for your group`);
    }
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/groups/:id/members/:userId', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2',
      [req.params.userId, req.params.id]
    );
    // Remove the group association from the user's requests unless explicitly assigned
    await removeUserRequestGroup(req.params.userId, req.params.id);
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Companies Routes
app.get('/api/companies', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/companies', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { companyId, name, industry, companyType, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Company name is required' });
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO companies (id, company_id, name, industry, company_type, email, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, companyId || null, name, industry || null, companyType || null, email || null, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Company ID already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/companies/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { companyId, name, industry, companyType, email, phone } = req.body;
    const result = await pool.query(
      'UPDATE companies SET company_id = COALESCE($1, company_id), name = COALESCE($2, name), industry = COALESCE($3, industry), company_type = COALESCE($4, company_type), email = COALESCE($5, email), phone = COALESCE($6, phone) WHERE id = $7 RETURNING *',
      [companyId, name, industry, companyType, email, phone, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/companies/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
    res.json({ message: 'Company deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Database Tables
app.get('/api/db-tables', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    res.json(tablesResult.rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/db-tables/:tableName', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { tableName } = req.params;
    const allowedTables = ['users', 'categories', 'priorities', 'statuses', 'requests', 'comments', 'activity_log'];
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    const dataResult = await pool.query(`SELECT * FROM ${tableName} ORDER BY 1 LIMIT 200`);
    res.json({ columns: columnsResult.rows, rows: dataResult.rows, count: dataResult.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// System Settings - create table if not exists
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    const defaultSettings = [
      { key: 'systemName', value: 'RHMS Support System' },
      { key: 'companyName', value: 'RHMS' },
      { key: 'systemEmail', value: 'support@rhms.com' },
      { key: 'timeZone', value: 'Africa/Addis_Ababa' },
      { key: 'language', value: 'en' },
      { key: 'requestPrefix', value: 'REQ' },
      { key: 'phoneNumber', value: '' },
      { key: 'address', value: '' },
      { key: 'maxFileSize', value: '10' },
      { key: 'allowedFileTypes', value: JSON.stringify(['jpg', 'png', 'gif', 'pdf', 'docx', 'xlsx']) },
      { key: 'emailNotifications', value: 'true' },
      { key: 'inAppNotifications', value: 'true' },
      { key: 'notifyClientStatusChange', value: 'true' },
      { key: 'notifyDeveloperAssignment', value: 'true' },
      { key: 'autoAssign', value: 'false' },
      { key: 'soundAlerts', value: 'true' },
      { key: 'desktopNotifications', value: 'true' },
      { key: 'sessionTimeout', value: '30' },
      { key: 'passwordExpiry', value: '90' },
      { key: 'passwordLength', value: '8' },
      { key: 'twoFactorAuth', value: 'false' },
      { key: 'maxLoginAttempts', value: '5' },
      { key: 'defaultStatus', value: '1' },
      { key: 'defaultPriority', value: '2' },
      { key: 'autoRequestId', value: 'true' },
      { key: 'allowReopen', value: 'true' },
      { key: 'theme', value: 'partial' },
      { key: 'assignmentMode', value: 'group-based' },
      { key: 'defaultGroup', value: '' },
      { key: 'maintenanceMode', value: 'false' },
      { key: 'responseHours', value: '4' },
      { key: 'resolutionHours', value: '48' },
      { key: 'escalationEnabled', value: 'true' },
      { key: 'workStart', value: '09:00' },
      { key: 'workEnd', value: '17:00' },
      { key: 'weekendDays', value: JSON.stringify(['saturday', 'sunday']) },
      { key: 'holidaysEnabled', value: 'true' },
      { key: 'autoBackup', value: 'false' },
      { key: 'backupFrequency', value: 'weekly' },
      { key: 'accentColor', value: '#00b4d8' },
      { key: 'sidebarStyle', value: 'comfortable' },
      { key: 'systemLogo', value: '' },
    ];
    for (const s of defaultSettings) {
      await pool.query(
        'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
        [s.key, s.value]
      );
    }
    console.log('system_settings table ready');
  } catch (err) {
    console.log('Settings table init error:', err.message);
  }
})();

app.get('/api/settings/public', async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM system_settings WHERE key IN ('theme', 'language', 'systemName', 'maintenanceMode', 'companyName', 'systemLogo')");
    const settings = {};
    for (const row of result.rows) {
      if (row.value === 'true') settings[row.key] = true;
      else if (row.value === 'false') settings[row.key] = false;
      else settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/settings', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM system_settings');
    const settings = {};
    for (const row of result.rows) {
      if (row.key === 'allowedFileTypes' || row.key === 'weekendDays') {
        try { settings[row.key] = JSON.parse(row.value); } catch { settings[row.key] = row.value; }
      } else if (row.value === 'true') {
        settings[row.key] = true;
      } else if (row.value === 'false') {
        settings[row.key] = false;
      } else if (!isNaN(row.value) && row.value !== '') {
        settings[row.key] = Number(row.value);
      } else {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/settings', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await pool.query(
        'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [key, stringValue]
      );
    }
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/settings/reset', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const defaults = [
      { key: 'systemName', value: 'RHMS Support System' },
      { key: 'companyName', value: 'RHMS' },
      { key: 'systemEmail', value: 'support@rhms.com' },
      { key: 'timeZone', value: 'Africa/Addis_Ababa' },
      { key: 'language', value: 'en' },
      { key: 'requestPrefix', value: 'REQ' },
      { key: 'phoneNumber', value: '' },
      { key: 'address', value: '' },
      { key: 'maxFileSize', value: '10' },
      { key: 'allowedFileTypes', value: JSON.stringify(['jpg', 'png', 'gif', 'pdf', 'docx', 'xlsx']) },
      { key: 'emailNotifications', value: 'true' },
      { key: 'inAppNotifications', value: 'true' },
      { key: 'notifyClientStatusChange', value: 'true' },
      { key: 'notifyDeveloperAssignment', value: 'true' },
      { key: 'autoAssign', value: 'false' },
      { key: 'soundAlerts', value: 'true' },
      { key: 'desktopNotifications', value: 'true' },
      { key: 'sessionTimeout', value: '30' },
      { key: 'passwordExpiry', value: '90' },
      { key: 'passwordLength', value: '8' },
      { key: 'twoFactorAuth', value: 'false' },
      { key: 'maxLoginAttempts', value: '5' },
      { key: 'defaultStatus', value: '1' },
      { key: 'defaultPriority', value: '2' },
      { key: 'autoRequestId', value: 'true' },
      { key: 'allowReopen', value: 'true' },
      { key: 'theme', value: 'partial' },
      { key: 'accentColor', value: '#00b4d8' },
      { key: 'sidebarStyle', value: 'comfortable' },
      { key: 'assignmentMode', value: 'group-based' },
      { key: 'defaultGroup', value: '' },
      { key: 'maintenanceMode', value: 'false' },
      { key: 'responseHours', value: '4' },
      { key: 'resolutionHours', value: '48' },
      { key: 'escalationEnabled', value: 'true' },
      { key: 'workStart', value: '09:00' },
      { key: 'workEnd', value: '17:00' },
      { key: 'weekendDays', value: JSON.stringify(['saturday', 'sunday']) },
      { key: 'holidaysEnabled', value: 'true' },
      { key: 'autoBackup', value: 'false' },
      { key: 'backupFrequency', value: 'weekly' },
      { key: 'systemLogo', value: '' },
    ];
    for (const s of defaults) {
      await pool.query(
        'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
        [s.key, s.value]
      );
    }
    res.json({ message: 'Settings reset to defaults' });
  } catch (err) {
    console.error('Reset settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});



// Logo upload
app.post('/api/settings/logo', authMiddleware, roleMiddleware('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoPath = `/uploads/${req.file.filename}`;
    await pool.query(
      'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      ['systemLogo', logoPath]
    );
    res.json({ logo: logoPath });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/settings/logo', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      ['systemLogo', '']
    );
    res.json({ message: 'Logo removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Error handler for multer/file upload errors
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large. Max 10MB.' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ error: 'Unexpected file field: ' + err.field });
  if (err) return res.status(500).json({ error: err.message || 'Server error' });
  next();
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

app.listen(PORT, () => {
  console.log(`RHMS Server running on http://localhost:${PORT}`);
});
