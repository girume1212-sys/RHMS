const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('./db');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'rhms-secret-key-2024';

app.use(cors());
app.use(express.json());
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

const mapUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatar: u.avatar,
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

// Auth Routes
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

// Users Routes
app.get('/api/users', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, avatar, created_at',
      [id, name, email, hashedPassword, role || 'client']
    );
    res.status(201).json(mapUser(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, email, role } = req.body;
    const result = await pool.query(
      'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), role = COALESCE($3, role) WHERE id = $4 RETURNING id, name, email, role, avatar, created_at',
      [name, email, role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(mapUser(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
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
    if (req.user.role === 'developer') {
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
    const { subject, description, categoryId, priorityId } = req.body;
    const countResult = await pool.query('SELECT COUNT(*) FROM requests');
    const count = parseInt(countResult.rows[0].count) + 129;
    const id = `REQ-2024-${String(count).padStart(5, '0')}`;
    const clientId = req.user.role === 'client' ? req.user.id : req.body.clientId;
    const now = new Date().toISOString();

    await pool.query(
      'INSERT INTO requests (id, subject, description, client_id, category_id, priority_id, status_id, attachments, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, subject, description, clientId, categoryId, priorityId || '2', '1', '[]', now, now]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'created', id, req.user.id, 'New request created', now]
    );

    res.status(201).json({ id, subject, description, clientId, categoryId, priorityId: priorityId || '2', statusId: '1', assignedTo: null, attachments: [], createdAt: now, updatedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, statusId, assignedTo } = req.body;
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

    await pool.query(
      'UPDATE requests SET subject = COALESCE($1, subject), description = COALESCE($2, description), category_id = COALESCE($3, category_id), priority_id = COALESCE($4, priority_id), status_id = $5, assigned_to = $6, updated_at = $7 WHERE id = $8',
      [subject, description, categoryId, priorityId, newStatusId, newAssignedTo, now, req.params.id]
    );

    if (statusId && statusId !== existing.rows[0].status_id) {
      const statusResult = await pool.query('SELECT name FROM statuses WHERE id = $1', [statusId]);
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'status_update', req.params.id, req.user.id, `updated to ${statusResult.rows[0]?.name}`, now]
      );
    }

    if (assignedTo && assignedTo !== existing.rows[0].assigned_to) {
      const assigneeResult = await pool.query('SELECT name FROM users WHERE id = $1', [assignedTo]);
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'assigned', req.params.id, req.user.id, `Assigned to ${assigneeResult.rows[0]?.name || 'Unknown'}`, now]
      );
    }

    res.json({ id: req.params.id, subject: subject || existing.rows[0].subject, description: description || existing.rows[0].description, clientId: existing.rows[0].client_id, categoryId: categoryId || existing.rows[0].category_id, priorityId: priorityId || existing.rows[0].priority_id, statusId: newStatusId, assignedTo: newAssignedTo, attachments: typeof existing.rows[0].attachments === 'string' ? JSON.parse(existing.rows[0].attachments) : existing.rows[0].attachments, createdAt: existing.rows[0].created_at, updatedAt: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Comments Routes
app.post('/api/requests/:id/comments', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM requests WHERE id = $1', [req.params.id]);
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

    res.status(201).json({ id, requestId: req.params.id, userId: req.user.id, content, createdAt: now, user: mapUser(req.user) });
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
    if (req.user.role === 'developer') {
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

// Activity Log
app.get('/api/activity', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar, u.created_at as user_created_at,
        r.subject as request_subject
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN requests r ON al.request_id = r.id
      ORDER BY al.created_at DESC
      LIMIT 20
    `);
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

    res.json({
      total,
      byStatus: byStatusResult.rows,
      byPriority: byPriorityResult.rows,
      byCategory: byCategoryResult.rows,
      avgResolutionTime: '2.5 days',
      clientSatisfaction: '87%',
      totalUsers: parseInt(totalUsersResult.rows[0].count),
      activeUsers: parseInt(activeUsersResult.rows[0].count)
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
    { id: 'support', name: 'Support Team', permissions: ['manage_requests', 'assign', 'comment', 'view_all'] },
    { id: 'developer', name: 'Developer', permissions: ['update_status', 'comment', 'view_assigned'] },
    { id: 'client', name: 'Client', permissions: ['create_request', 'comment', 'view_own'] }
  ]);
});

// System Settings
app.get('/api/settings', authMiddleware, roleMiddleware('admin'), (req, res) => {
  res.json({
    companyName: 'RHMS',
    supportEmail: 'support@rhms.com',
    maxFileSize: '10MB',
    allowedFileTypes: ['jpg', 'png', 'gif', 'pdf', 'docx', 'xlsx'],
    autoAssign: false,
    emailNotifications: true,
    requestPrefix: 'REQ',
    slaHours: 48
  });
});

app.listen(PORT, () => {
  console.log(`RHMS Server running on http://localhost:${PORT}`);
});
