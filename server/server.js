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
    console.log('user_groups table and groups ready');
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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT ''`);
    console.log('company_name column ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false`);
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


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

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

const mapUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
  companyName: u.company_name || '',
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
    const { name, email, password, companyName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password, role, company_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, avatar, created_at, company_name',
      [id, name, email, hashedPassword, 'client', companyName || '']
    );
    res.status(201).json({ message: 'Account created successfully', user: mapUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Please try again' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
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
app.get('/api/users', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.company_name, u.approved, u.created_at
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
    const { name, email, password, role, groupIds, companyName } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, company_name) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, name, email, hashedPassword, role || 'client', companyName || '']
    );
    try {
      if (groupIds && groupIds.length > 0) {
        for (const gid of groupIds) {
          await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, gid]);
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
    const { name, email, role, groupIds, password } = req.body;
    let query, params;
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role), password = $4 WHERE id = $5 RETURNING *';
      params = [name, email, role, hashedPassword, req.params.id];
    } else {
      query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role) WHERE id = $4 RETURNING *';
      params = [name, email, role, req.params.id];
    }
    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    try {
      await pool.query('DELETE FROM user_groups WHERE user_id = $1', [req.params.id]);
      if (groupIds && groupIds.length > 0) {
        for (const gid of groupIds) {
          await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, gid]);
        }
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
    const { name, email, password, companyName } = req.body;
    const userId = req.user.id;
    let avatarPath = undefined;
    if (req.file) {
      avatarPath = `/uploads/${req.file.filename}`;
    }
    let query, params;
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      if (avatarPath) {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password = $3, company_name = COALESCE($4, company_name), avatar = $5 WHERE id = $6 RETURNING *';
        params = [name, email, hashedPassword, companyName || '', avatarPath, userId];
      } else {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), password = $3, company_name = COALESCE($4, company_name) WHERE id = $5 RETURNING *';
        params = [name, email, hashedPassword, companyName || '', userId];
      }
    } else {
      if (avatarPath) {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), company_name = COALESCE($3, company_name), avatar = $4 WHERE id = $5 RETURNING *';
        params = [name, email, companyName || '', avatarPath, userId];
      } else {
        query = 'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), company_name = COALESCE($3, company_name) WHERE id = $4 RETURNING *';
        params = [name, email, companyName || '', userId];
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
        a.name as assignee_name, a.email as assignee_email, a.role as assignee_role, a.avatar as assignee_avatar, a.created_at as assignee_created_at
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      LEFT JOIN statuses s ON r.status_id = s.id
      LEFT JOIN users a ON r.assigned_to = a.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (req.user.role === 'client') {
      query += ` AND r.client_id = $${paramIndex++}`;
      params.push(req.user.id);
    }
    if (req.user.role === 'developer' || req.user.role === 'support') {
      query += ` AND r.assigned_to = $${paramIndex++}`;
      params.push(req.user.id);
    }

    const { status, priority, category, search } = req.query;
    if (status) {
      query += ` AND r.status_id = $${paramIndex++}`;
      params.push(status);
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
      assignee: r.assignee_name ? { id: r.assigned_to, name: r.assignee_name, email: r.assignee_email, role: r.assignee_role, avatar: r.assignee_avatar, createdAt: r.assignee_created_at } : null
    }));
    res.json(enriched);
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
        a.name as assignee_name, a.email as assignee_email, a.role as assignee_role, a.avatar as assignee_avatar, a.created_at as assignee_created_at
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      LEFT JOIN statuses s ON r.status_id = s.id
      LEFT JOIN users a ON r.assigned_to = a.id
      WHERE r.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    const r = result.rows[0];

    if (req.user.role === 'client' && r.client_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
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
      comments: commentsResult.rows.map(c => ({
        id: c.id,
        requestId: c.request_id,
        userId: c.user_id,
        content: c.content,
        createdAt: c.created_at,
        user: c.user_name ? { id: c.user_id, name: c.user_name, email: c.user_email, role: c.user_role, avatar: c.user_avatar, createdAt: c.user_created_at } : null
      }))
    };
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, attachments } = req.body;
    const countResult = await pool.query('SELECT COUNT(*) FROM requests');
    const count = parseInt(countResult.rows[0].count) + 129;
    const id = `REQ-2024-${String(count).padStart(5, '0')}`;
    const clientId = req.user.role === 'client' ? req.user.id : req.body.clientId;
    const now = new Date().toISOString();

    await pool.query(
      'INSERT INTO requests (id, subject, description, client_id, category_id, priority_id, status_id, attachments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, subject, description, clientId, categoryId, priorityId || '2', '1', JSON.stringify(attachments || []), now, now]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'created', id, req.user.id, 'New request created', now]
    );

    // Real-time notification
    notifyAdmins('New request created', { type: 'request_created', requestId: id, subject, userId: req.user.id });

    res.status(201).json({ id, subject, description, clientId, categoryId, priorityId: priorityId || '2', statusId: '1', assignedTo: null, attachments: attachments || [], createdAt: now, updatedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Please fill all required fields' });
  }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, statusId, assignedTo, attachments } = req.body;
    const now = new Date().toISOString();

    const existing = await pool.query('SELECT * FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    let newStatusId = existing.rows[0].status_id;
    let newAssignedTo = existing.rows[0].assigned_to;

    if (statusId) newStatusId = statusId;
    if (assignedTo !== undefined) newAssignedTo = assignedTo || null;

    if (assignedTo && assignedTo !== existing.rows[0].assigned_to) {
      newStatusId = '2';
    }

    const newAttachments = attachments !== undefined ? attachments : (typeof existing.rows[0].attachments === 'string' ? JSON.parse(existing.rows[0].attachments) : existing.rows[0].attachments);

    await pool.query(
      'UPDATE requests SET subject = COALESCE($1, subject), description = COALESCE($2, description), category_id = COALESCE($3, category_id), priority_id = COALESCE($4, priority_id), status_id = $5, assigned_to = $6, attachments = $7, updated_at = $8 WHERE id = $9',
      [subject, description, categoryId, priorityId, newStatusId, newAssignedTo, JSON.stringify(newAttachments), now, req.params.id]
    );

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
      // Real-time notification for status change
      const statusName = newStatusName;
      const clientId = existing.rows[0].client_id;
      notifyAdmins(`Request #${req.params.id} status changed to ${statusName}`, { type: 'status_change', requestId: req.params.id, status: statusName, userId: req.user.id });
      // Notify the client
      if (clientId && clientId !== req.user.id) {
        notifyUser(clientId, `Your request #${req.params.id} status changed to ${statusName}`, { type: 'status_change', requestId: req.params.id, status: statusName, userId: req.user.id });
      }
    }

    if (assignedTo && assignedTo !== existing.rows[0].assigned_to) {
      const assigneeResult = await pool.query('SELECT name FROM users WHERE id = $1', [assignedTo]);
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'assigned', req.params.id, req.user.id, `Assigned to ${assigneeResult.rows[0]?.name || 'Unknown'}`, now]
      );
      // Real-time notification for assignment
      const assigneeName = assigneeResult.rows[0]?.name || 'Unknown';
      const clientId = existing.rows[0].client_id;
      notifyAdmins(`Request #${req.params.id} assigned to ${assigneeName}`, { type: 'assigned', requestId: req.params.id, assignee: assigneeName, userId: req.user.id });
      // Notify the assigned user
      notifyUser(assignedTo, `You have been assigned to Request #${req.params.id}`, { type: 'assigned', requestId: req.params.id, userId: req.user.id });
      // Notify the client
      if (clientId && clientId !== req.user.id) {
        notifyUser(clientId, `Your request #${req.params.id} has been assigned to ${assigneeName}`, { type: 'assigned', requestId: req.params.id, assignee: assigneeName, userId: req.user.id });
      }
    }

    res.json({ id: req.params.id, subject: subject || existing.rows[0].subject, description: description || existing.rows[0].description, clientId: existing.rows[0].client_id, categoryId: categoryId || existing.rows[0].category_id, priorityId: priorityId || existing.rows[0].priority_id, statusId: newStatusId, assignedTo: newAssignedTo, attachments: newAttachments, createdAt: existing.rows[0].created_at, updatedAt: now });
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
    notifyAdmins(`Request #${req.params.id} deleted`, { type: 'request_deleted', requestId: req.params.id, userId: req.user.id });
    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Comments Routes
app.post('/api/requests/:id/comments', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, client_id FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    const { content } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    await pool.query(
      'INSERT INTO comments (id, request_id, user_id, content, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, req.params.id, req.user.id, content, now]
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

// Upload Route
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
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
      whereClause += ` AND r.assigned_to = $${paramIndex++}`;
      params.push(req.user.id);
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
    const resolved = statusMap['5'] || 0;
    const closed = statusMap['6'] || 0;

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
      resolved,
      closed,
      byStatus,
      byPriority,
      byCategory,
      dailyData,
      totalLastWeek: Math.floor(total * 0.88),
      openLastWeek: Math.floor(open * 0.92),
      inProgressLastWeek: Math.floor(inProgress * 0.95),
      resolvedLastWeek: Math.floor(resolved * 0.85),
      closedLastWeek: Math.floor(closed * 1.05)
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

    res.json({ labels, byCompany, byDeveloper });
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
app.get('/api/requests/:id/activity', authMiddleware, async (req, res) => {
  try {
    if (req.user.role === 'client') {
      const ownership = await pool.query('SELECT id FROM requests WHERE id = $1 AND client_id = $2', [req.params.id, req.user.id]);
      if (ownership.rows.length === 0) return res.status(403).json({ error: 'Access denied' });
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
        COUNT(CASE WHEN s.name = 'Open' OR s.name = 'Assigned' THEN 1 END) AS pending
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
app.get('/api/groups', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM groups ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/groups', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO groups (id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description || '', color || '#6B7280']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/groups/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, description, color } = req.body;
    const result = await pool.query(
      'UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color) WHERE id = $4 RETURNING *',
      [name, description, color, req.params.id]
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
      { key: 'companyName', value: 'RHMS' },
      { key: 'supportEmail', value: 'support@rhms.com' },
      { key: 'requestPrefix', value: 'REQ' },
      { key: 'phoneNumber', value: '' },
      { key: 'address', value: '' },
      { key: 'maxFileSize', value: '10' },
      { key: 'allowedFileTypes', value: JSON.stringify(['jpg', 'png', 'gif', 'pdf', 'docx', 'xlsx']) },
      { key: 'emailNotifications', value: 'true' },
      { key: 'autoAssign', value: 'false' },
      { key: 'soundAlerts', value: 'true' },
      { key: 'desktopNotifications', value: 'true' },
      { key: 'sessionTimeout', value: '30' },
      { key: 'passwordExpiry', value: '90' },
      { key: 'twoFactorAuth', value: 'false' },
      { key: 'maxLoginAttempts', value: '5' },
      { key: 'responseHours', value: '4' },
      { key: 'resolutionHours', value: '48' },
      { key: 'escalationEnabled', value: 'true' },
      { key: 'workStart', value: '09:00' },
      { key: 'workEnd', value: '17:00' },
      { key: 'weekendDays', value: JSON.stringify(['saturday', 'sunday']) },
      { key: 'holidaysEnabled', value: 'true' },
      { key: 'autoBackup', value: 'false' },
      { key: 'backupFrequency', value: 'weekly' },
      { key: 'maintenanceMode', value: 'false' },
      { key: 'accentColor', value: '#00b4d8' },
      { key: 'sidebarStyle', value: 'comfortable' },
      { key: 'language', value: 'en' },
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



app.listen(PORT, () => {
  console.log(`RHMS Server running on http://localhost:${PORT}`);
});
