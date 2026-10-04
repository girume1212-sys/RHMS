require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const pool = require('./db');
const mailer = require('./mailer');
const { logActivity, logActivityWithContext, logAuthActivity, logRequestActivity, logUserActivity, logGroupActivity, logCompanyActivity, logSettingsActivity, logSearchActivity } = require('./activityLogger');

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
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_deleted BOOLEAN NOT NULL DEFAULT FALSE`);
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
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS custom_category TEXT`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]'`);
    console.log('requests columns ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT ''`);
    console.log('company_name column ready');
    // Ownership trail for account reclaim after admin deletion: stores the
    // owner's verified email so a later verified re-registration with the same
    // email can be re-linked to its previous requests/comments. Never exposed
    // for auth; reclaim only touches orphaned rows (client_id/user_id IS NULL).
    await pool.query(`ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_email VARCHAR(255) DEFAULT ''`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_client_email ON requests(client_email)`);
    await pool.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS author_email VARCHAR(255) DEFAULT ''`);
    console.log('ownership trail columns ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en'`);
    console.log('language column ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ALTER COLUMN approved SET DEFAULT true`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0`);
    console.log('approved column ready');
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS moderated BOOLEAN DEFAULT true`);
    console.log('moderated column ready');
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        entity_type VARCHAR(50),
        entity_id VARCHAR(50),
        ip_address VARCHAR(45),
        user_agent TEXT,
        details JSONB,
        severity VARCHAR(20) DEFAULT 'info'
      )
    `);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50)`);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_id VARCHAR(50)`);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)`);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS user_agent TEXT`);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS details JSONB`);
    await pool.query(`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_severity ON activity_log(severity)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_type_created ON activity_log(type, created_at DESC)`);
    console.log('activity_log table ready');
    await pool.query(`ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE statuses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE`);
    await pool.query(`
      INSERT INTO statuses (id, name, color, is_system, sort_order) VALUES ('8', 'Rejected', '#DC2626', TRUE, 8)
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`
      INSERT INTO statuses (id, name, color, is_system, sort_order) VALUES ('9', 'Escalated', '#EF4444', TRUE, 9)
      ON CONFLICT (id) DO NOTHING
    `);
    await pool.query(`UPDATE statuses SET is_system = TRUE WHERE id IN ('1', '2', '3', '4', '5', '6', '7')`);
    await pool.query(`UPDATE statuses SET sort_order = CAST(id AS INTEGER) WHERE sort_order = 0 AND id ~ '^[0-9]+$'`);
    const reopenedStatus = await pool.query(`SELECT id FROM statuses WHERE LOWER(name) = 'reopened'`);
    if (reopenedStatus.rows.length > 0) {
      const reopenedId = reopenedStatus.rows[0].id;
      await pool.query(`UPDATE requests SET status_id = (SELECT id FROM statuses WHERE LOWER(name) = 'new' LIMIT 1) WHERE status_id = $1`, [reopenedId]);
      await pool.query(`DELETE FROM statuses WHERE id = $1`, [reopenedId]);
    }
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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL DEFAULT 'info',
        title VARCHAR(500),
        message TEXT NOT NULL,
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        is_read BOOLEAN NOT NULL DEFAULT false,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON notifications(request_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)`);
    console.log('notifications table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comment_read_tracking (
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id)
      )
    `);
    console.log('comment_read_tracking table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        refresh_token_hash VARCHAR(255) UNIQUE,
        user_agent TEXT,
        ip_address VARCHAR(45),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
    console.log('sessions table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_audit (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
        email VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_audit_action ON login_audit(action)`);
    console.log('login_audit table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by_ip VARCHAR(45)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at)`);
    console.log('password_reset_tokens table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by_ip VARCHAR(45)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_otp_user ON password_reset_otps(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_otp_expires ON password_reset_otps(expires_at)`);
    console.log('password_reset_otps table ready');

    // Registration email-verification codes. Separate from password-reset OTPs:
    // no user row exists yet, so the code is keyed by (lowercased) email address.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_verification_codes (
        id VARCHAR(50) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by_ip VARCHAR(45)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verify_email ON email_verification_codes(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_email_verify_expires ON email_verification_codes(expires_at)`);
    console.log('email_verification_codes table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sla_tracking (
        id VARCHAR(50) PRIMARY KEY,
        request_id VARCHAR(50) NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
        sla_policy_id VARCHAR(50) REFERENCES sla_policies(id) ON DELETE SET NULL,
        response_due_at TIMESTAMP WITH TIME ZONE,
        resolution_due_at TIMESTAMP WITH TIME ZONE,
        first_response_at TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        response_breached BOOLEAN NOT NULL DEFAULT false,
        resolution_breached BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sla_tracking_policy ON sla_tracking(sla_policy_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sla_tracking_due ON sla_tracking(response_due_at, resolution_due_at)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sla_tracking_breached ON sla_tracking(response_breached, resolution_breached)`);
    console.log('sla_tracking table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_watchers (
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (request_id, user_id)
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_request_watchers_user ON request_watchers(user_id)`);
    console.log('request_watchers table ready');
    // Registry of admin-deleted accounts so login can report a clear message
    // instead of a generic invalid-credentials error. Never blocks re-registration.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deleted_accounts (
        email VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_deleted_accounts_name ON deleted_accounts(name)`);
    // Performance indexes for hot filters/joins (safe, IF NOT EXISTS)
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_assigned ON requests(assigned_to)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_request ON comments(request_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_groups_user ON user_groups(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_groups_group ON user_groups(group_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC)`);
  } catch (err) {
    console.log('Init error:', err.message);
  }
})();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
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
    const result = await pool.query('SELECT id, name, email, role, avatar, created_at, approved FROM users WHERE id = $1', [decoded.id]);
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

// Persist a notification to the notifications table (best-effort, never throws)
async function persistNotification(userId, message, data = {}) {
  try {
    await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), userId, data.type || 'info', data.title || null,
        message || '', (data.requestId && String(data.requestId).match(/^REQ-\d+/)) ? data.requestId : null]
    );
  } catch (err) {
    console.error('Failed to persist notification:', err.message);
  }
}

// SSE notification helper (also persists to notifications table)
function notifyAdmins(message, data = {}) {
  const payload = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
  const actorId = data.userId ? String(data.userId) : null;
  for (const [userId, clients] of sseClients) {
    if (actorId && String(userId) === actorId) continue;
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
  persistNotification('all-admins', message, data);
  pool.query('SELECT id FROM users WHERE role = $1 OR role = $2 OR role = $3', ['admin', 'support', 'developer'])
    .then(r => r.rows.forEach(row => {
      if (!actorId || String(row.id) !== actorId) persistNotification(row.id, message, data);
    }))
    .catch(() => {});
}

function notifyAll(message, data = {}) {
  const payload = JSON.stringify({ message, data, timestamp: new Date().toISOString() });
  const actorId = data.userId ? String(data.userId) : null;
  for (const [userId, clients] of sseClients) {
    if (actorId && String(userId) === actorId) continue;
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        clients.delete(client);
      }
    }
  }
  pool.query('SELECT id FROM users')
    .then(r => r.rows.forEach(row => {
      if (!actorId || String(row.id) !== actorId) persistNotification(row.id, message, data);
    }))
    .catch(() => {});
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
  persistNotification(userId, message, data);
}

// Record an authentication or privileged action in login_audit (best-effort)
async function auditLogin(action, userId, email, req) {
  try {
    await pool.query(
      `INSERT INTO login_audit (id, user_id, email, action, ip_address, user_agent, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [uuidv4(), userId || null, email || null, action,
        (req && (req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress)) || null,
        (req && req.headers['user-agent']) || null, null]
    );
  } catch (err) {
    console.error('Failed to persist login_audit:', err.message);
  }
}

// Create a persisted session row (best-effort)
async function persistSession(userId, token, req) {
  try {
    const expiresInMs = (() => {
      try {
        return jwt.decode(token) ? (jwt.decode(token).exp || 0) * 1000 : 0;
      } catch { return 0; }
    })();
    await pool.query(
      `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (token_hash) DO NOTHING`,
      [uuidv4(), userId, token,
        (req && req.headers['user-agent']) || null,
        (req && (req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress)) || null,
        expiresInMs ? new Date(expiresInMs) : new Date(Date.now() + 24 * 60 * 60 * 1000)]
    );
  } catch (err) {
    console.error('Failed to persist session:', err.message);
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
  selfRegistered: u.self_registered || false,
  moderated: u.moderated || false,
  createdAt: u.created_at
});

const mapRequest = (r) => ({
  id: r.id,
  subject: r.subject,
  description: r.description,
  clientId: r.client_id,
  categoryId: r.category_id,
  customCategory: r.custom_category || null,
  priorityId: r.priority_id,
  statusId: r.status_id,
  assignedTo: r.assigned_to,
  attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

// Shared RHMS email logo block. The logo is ALWAYS rendered first, centered,
// in its own full-width row: [LOGO] -> Welcome heading -> brand name ->
// content. Uses the existing systemLogo setting with the existing CID
// inline-image method so real clients render it without fetching a URL.
async function getEmailLogoBlock(req) {
  const escapeHtml = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let logoUrl = '';
  let logoAttachment = null;
  try {
    const logoResult = await pool.query("SELECT value FROM system_settings WHERE key = 'systemLogo'");
    const logoPath = logoResult.rows.length > 0 ? (logoResult.rows[0].value || '') : '';
    if (logoPath) {
      if (logoPath.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, 'uploads', path.basename(logoPath));
        const ext = path.extname(filePath).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext) && fs.existsSync(filePath)) {
          logoAttachment = { filename: `rhms-logo${ext}`, path: filePath, cid: 'rhmslogo' };
        } else if (req) {
          logoUrl = `${req.protocol}://${req.get('host')}${logoPath}`;
        }
      } else if (req) {
        logoUrl = logoPath.startsWith('http')
          ? logoPath
          : `${req.protocol}://${req.get('host')}${logoPath.startsWith('/') ? '' : '/'}${logoPath}`;
      } else {
        logoUrl = logoPath;
      }
    }
  } catch (e) { /* logo is decorative; never block the email */ }
  const imgStyle = 'display:block;margin:0 auto;height:auto;max-width:160px;border:0;';
  const logoBlock = logoAttachment
    ? `<img src="cid:rhmslogo" alt="RHMS Logo" width="160" style="${imgStyle}" />`
    : logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="RHMS Logo" width="160" style="${imgStyle}" />`
      : `<div style="font-size:42px;font-weight:800;letter-spacing:2px;color:#1D4ED8;text-align:center;">RHMS</div>`;
  return { logoBlock, logoAttachment };
}

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
    const verificationCode = (req.body.code || req.body.verificationCode || '').trim();
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({ error: 'This email address does not exist or cannot be verified. Please use a valid email address.' });
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
    // Email must have been verified via /api/auth/request-email-verification.
    // No user row is created until the mailbox proves it can receive the code.
    if (!verificationCode) {
      return res.status(400).json({ error: 'Email verification is required. Please verify your email address first.' });
    }
    const check = await findValidEmailCode(String(email).trim().toLowerCase(), verificationCode);
    if (!check.ok) {
      if (check.id && check.reason === 'mismatch') {
        await pool.query('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1', [check.id]);
      }
      if (check.reason === 'expired') {
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }
      if (check.reason === 'locked') {
        return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      }
      return res.status(400).json({ error: 'Email verification failed. Please verify your email address first.' });
    }
    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    let result;
    try {
      result = await pool.query(
        'INSERT INTO users (id, name, email, password, role, company_name, language, approved, moderated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, role, avatar, created_at, company_name, language, approved, moderated',
        [id, name, email, hashedPassword, 'client', companyName || '', ['en', 'am'].includes(language) ? language : 'en', true, false]
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Email already exists' });
      }
      throw err;
    }
    // Consume the verification code (single-use).
    await pool.query('UPDATE email_verification_codes SET used_at = NOW() WHERE id = $1', [check.id]);
    // A fresh verified registration clears any prior deletion record for this
    // email; the new row above is a brand-new account, never a restoration.
    try {
      await pool.query('DELETE FROM deleted_accounts WHERE email = LOWER($1)', [String(email).trim()]);
    } catch (e) { /* best-effort */ }
    // Re-associate this verified email's previous orphaned requests/comments
    // (left behind by an admin deletion) with the newly created account.
    // Only orphaned rows match, so another live account's data is untouched.
    // IDs, dates, statuses, comments, attachments and assignments are preserved.
    try {
      const freshId = result.rows[0].id;
      const verifiedEmail = String(email).trim().toLowerCase();
      await pool.query(
        `UPDATE requests SET client_id = $1, client_deleted = FALSE WHERE client_id IS NULL AND LOWER(client_email) = $2`,
        [freshId, verifiedEmail]
      );
      await pool.query(
        `UPDATE comments SET user_id = $1 WHERE user_id IS NULL AND LOWER(author_email) = $2`,
        [freshId, verifiedEmail]
      );
    } catch (e) { console.error('Failed to reclaim previous requests:', e.message); }

    // Auto-assign to default group
    const defGroup = await pool.query("SELECT value FROM system_settings WHERE key = 'defaultGroup'");
    const defaultGroupId = defGroup.rows.length > 0 ? defGroup.rows[0].value : '';
    if (defaultGroupId) {
      await pool.query('INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, defaultGroupId]);
    }

    auditLogin('signup', id, email, req);
    await logAuthActivity('signup', { id, name, email }, req);
    notifyAdmins(`New user registered: ${name} (${email})`, { type: 'user_registered', userId: id, userName: name });
    // Registration-success confirmation email. Sent ONLY after the account is
    // created, using the existing Gmail SMTP service. Fire-and-forget so the
    // signup response (and login navigation) never waits on SMTP delivery;
    // a failure is logged and never rolls back or duplicates the registration.
    const newUser = result.rows[0];
    const escapeHtml = (v) => String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeName = escapeHtml(newUser.name);
    const loginUrl = `${req.protocol}://${req.get('host')}/login`;
    const { logoBlock, logoAttachment } = await getEmailLogoBlock(req);
    mailer.sendMail({
      to: newUser.email,
      subject: 'RHMS Registration Successful',
      text:
        `Welcome to the Request Handling Management System!\n\n` +
        `Hello ${newUser.name},\n\n` +
        `🎉 You have successfully registered and verified your email.\n\n` +
        `Your RHMS account is now ready to use.\n\n` +
        `The Request Handling Management System (RHMS) provides a centralized platform for managing support requests and issues. It allows users to submit and track requests while support teams and developers can efficiently manage, assign, resolve, and monitor issues from creation through completion.\n\n` +
        `Sign in to RHMS: ${loginUrl}\n\n` +
        `Your account is now ready to use. Sign in using your registered email address and password.\n\n` +
        `Regards,\nRHMS Request Handling Management System\n\n` +
        `If you did not create this account, please contact the RHMS administrator.`,
      html:
        `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
        `<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">` +
        `<tr><td align="center">` +
        `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">` +
        `<tr><td align="center" style="background-color:#ffffff;padding:36px 32px 8px;text-align:center;">` +
        logoBlock +
        `</td></tr>` +
        `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 8px;text-align:center;">` +
        `<h1 style="margin:0;font-size:24px;line-height:1.35;color:#1D4ED8;font-weight:700;">Welcome to the Request Handling Management System!</h1>` +
        `</td></tr>` +
        `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 28px;text-align:center;">` +
        `<h2 style="margin:0;font-size:18px;line-height:1.35;color:#0f172a;font-weight:700;">Request Handling Management System</h2>` +
        `</td></tr>` +
        `<tr><td style="padding:32px;">` +
        `<p style="margin:0 0 8px;font-size:16px;color:#0f172a;">Hello ${safeName},</p>` +
        `<p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1D4ED8;">🎉 You have successfully registered and verified your email.</p>` +
        `<p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Your RHMS account is now ready to use.</p>` +
        `<p style="margin:0 0 24px;font-size:14px;line-height:1.7;color:#475569;">The Request Handling Management System (RHMS) provides a centralized platform for managing support requests and issues. It allows users to submit and track requests while support teams and developers can efficiently manage, assign, resolve, and monitor issues from creation through completion.</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td align="center" bgcolor="#1D4ED8" style="border-radius:8px;">` +
        `<a href="${escapeHtml(loginUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">Sign In to RHMS</a>` +
        `</td></tr></table>` +
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">Your account is now ready to use. Sign in using your registered email address and password.</p>` +
        `<p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">Regards,<br><strong>RHMS Request Handling Management System</strong></p>` +
        `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you did not create this account, please contact the RHMS administrator.</p>` +
        `</td></tr>` +
        `<tr><td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">` +
        `<p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply to this email.</p>` +
        `</td></tr>` +
        `</table></td></tr></table></body></html>`,
      ...(logoAttachment ? { attachments: [logoAttachment] } : {}),
    }).then(() => {
      console.log(`[Signup] Registration confirmation email sent to ${newUser.email}`);
    }).catch((err) => {
      console.error('[Signup] Registration confirmation email failed:', err.message);
    });
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

    if (!user || !(await bcrypt.compare(password, user.password))) {
      if (user) {
        const currentAttempts = (user.login_attempts || 0) + 1;
        await pool.query('UPDATE users SET login_attempts = $1 WHERE id = $2', [currentAttempts, user.id]);
        auditLogin('login_failed', user.id, user.email, req);
        await logAuthActivity('login_failed', user, req, { credential });
        if (currentAttempts >= maxAttempts) {
          await pool.query("UPDATE users SET approved = false WHERE id = $1", [user.id]);
          await logAuthActivity('account_blocked', user, req, { reason: 'too_many_failed_attempts' });
        }
      } else {
        // The credential matches an admin-deleted account: report it clearly.
        // Never recreate or restore the account here; a fresh verified
        // registration is the only way back.
        try {
          const gone = await pool.query(
            'SELECT email FROM deleted_accounts WHERE email = LOWER($1) OR (name IS NOT NULL AND LOWER(name) = LOWER($1)) LIMIT 1',
            [String(credential || '')]
          );
          if (gone.rows.length > 0) {
            auditLogin('login_failed', null, credential, req);
            return res.status(410).json({ error: 'Your account no longer exists. Please register again to create a new account.' });
          }
        } catch (e) { /* fall through to the generic error */ }
        auditLogin('login_failed', null, credential, req);
        await logAuthActivity('login_failed', null, req, { credential });
      }
      return res.status(401).json({ error: 'Invalid username, email or password' });
    }

    if (user.login_attempts >= maxAttempts) {
      auditLogin('login_locked', user.id, user.email, req);
      await logAuthActivity('login_locked', user, req);
      return res.status(423).json({ error: 'Account locked due to too many failed attempts. Contact administrator.' });
    }

    await pool.query('UPDATE users SET login_attempts = 0 WHERE id = $1', [user.id]);

    const sessionResult = await pool.query("SELECT value FROM system_settings WHERE key = 'sessionTimeout'");
    const sessionTimeout = sessionResult.rows.length > 0 ? parseInt(sessionResult.rows[0].value) || 30 : 30;
    const expiresIn = sessionTimeout > 0 ? `${sessionTimeout}m` : '24h';

    const token = jwt.sign({ id: user.id, role: user.role, sessionTimeout }, JWT_SECRET, { expiresIn });
    auditLogin('login_success', user.id, user.email, req);
    await logAuthActivity('login_success', user, req);
    persistSession(user.id, token, req);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json(mapUser(req.user));
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash = $2', [user.id, require('crypto').createHash('sha256').update(req.headers.authorization?.split(' ')[1] || '').digest('hex')]);
    await logAuthActivity('logout', user, req);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
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
        [id, name, email, await bcrypt.hash(googleId, 10), 'client', picture || null]
      );
      user = result.rows[0];
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    auditLogin('login_success', user.id, email, req);
    const isNewUser = !result.rows[0]?.created_at || (Date.now() - new Date(result.rows[0].created_at).getTime() < 60000);
    await logAuthActivity(isNewUser ? 'google_signup' : 'google_login', user, req);
    persistSession(user.id, token, req);
    res.json({ token, user: mapUser(user) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// Password reset: SHA-256 of the raw token is stored; the raw token travels in the link.
const hashResetToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// Request a password reset link for an account. Generic response prevents user enumeration.
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const userResult = await pool.query('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [email]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);

      // Invalidate any previously issued, unused tokens for this user.
      await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL", [user.id]);

      const ttlResult = await pool.query("SELECT value FROM system_settings WHERE key = 'passwordResetTokenTtl'");
      const ttlMinutes = ttlResult.rows.length > 0 ? parseInt(ttlResult.rows[0].value) || 60 : 60;
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      await pool.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_by_ip, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), user.id, tokenHash, expiresAt,
          (req.headers['x-forwarded-for'] || req.ip || null)]
      );

      auditLogin('password_reset_requested', user.id, user.email, req);
      await logAuthActivity('password_reset_requested', user, req, { email });

      // No mailer is configured; surface the reset link on the server console and
      // as an in-app notification so the flow is usable on this local deployment.
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${rawToken}`;
      console.log(`[PasswordReset] Reset link for ${user.email}: ${resetUrl}`);
      notifyUser(user.id, `Password reset requested. Use this link within ${ttlMinutes} minutes: ${resetUrl}`,
        { type: 'password_reset', title: 'Password Reset' });
    }

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send password reset link' });
  }
});

// Validate a reset token without consuming it.
app.get('/api/auth/reset-password/validate', async (req, res) => {
  try {
    const rawToken = req.query.token || '';
    if (!rawToken) return res.json({ valid: false });
    const result = await pool.query(
      `SELECT t.expires_at, t.used_at, u.email, u.name, u.id
       FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [hashResetToken(rawToken)]
    );
    const row = result.rows[0];
    if (!row) return res.json({ valid: false, reason: 'not_found' });
    if (row.used_at) return res.json({ valid: false, reason: 'used' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.json({ valid: false, reason: 'expired' });
    res.json({ valid: true, email: row.email, name: row.name, expiresAt: row.expires_at });
  } catch (err) {
    console.error('Validate reset token error:', err);
    res.status(500).json({ error: 'Failed to validate reset token' });
  }
});

// Consume a valid reset token and set a new password.
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const rawToken = (req.body.token || '').trim();
    const { password } = req.body;
    if (!rawToken || !password) return res.status(400).json({ error: 'Token and password are required' });

    const pwResult = await pool.query("SELECT value FROM system_settings WHERE key = 'passwordLength'");
    const minLength = pwResult.rows.length > 0 ? parseInt(pwResult.rows[0].value) || 8 : 8;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }

    const result = await pool.query(
      `SELECT t.id AS token_id, t.expires_at, t.used_at, u.id AS user_id
       FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1`,
      [hashResetToken(rawToken)]
    );
    const row = result.rows[0];
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (row.used_at) return res.status(400).json({ error: 'Invalid or expired reset token' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Reset token has expired' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1, login_attempts = 0 WHERE id = $2', [hashedPassword, row.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.token_id]);
    // Revoke all existing sessions for the user so the new password takes effect.
    await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);

    const userResult = await pool.query('SELECT id, email FROM users WHERE id = $1', [row.user_id]);
    auditLogin('password_reset_success', row.user_id, userResult.rows[0]?.email, req);
    await logAuthActivity('password_reset_completed', { id: row.user_id, email: userResult.rows[0]?.email }, req);

    res.json({ message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---- Forgot-password via 6-digit email OTP ----
// No SMTP transporter is configured in this deployment; the existing RHMS email
// configuration is the `systemEmail` system setting. The OTP is delivered from
// that sender identity through the existing in-app notification channel
// (notifyUser/persistNotification) and surfaced on the server console, exactly
// like the existing reset-link flow. If an SMTP transporter is added later,
// sendPasswordResetOtpEmail is the single place to route through it.
async function sendPasswordResetOtpEmail(toEmail, userName, otp, ttlSeconds, req) {
  let fromAddress = 'support@rhms.com';
  try {
    const r = await pool.query("SELECT value FROM system_settings WHERE key = 'systemEmail'");
    if (r.rows.length > 0 && r.rows[0].value) fromAddress = r.rows[0].value;
  } catch (e) { /* fall back to default sender */ }
  const { logoBlock, logoAttachment } = await getEmailLogoBlock(req);
  const subject = 'RHMS Password Reset Code';
  const text =
    `Request Handling Management System\n\n` +
    `Your password reset verification code is:\n\n` +
    `${otp}\n\n` +
    `This code will expire in ${ttlSeconds} seconds.\n\n` +
    `If you did not request a password reset, please ignore this email.`;
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">` +
    `<tr><td align="center" style="background-color:#ffffff;padding:36px 32px 8px;text-align:center;">` +
    logoBlock +
    `</td></tr>` +
    `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 8px;text-align:center;">` +
    `<h1 style="margin:0;font-size:22px;line-height:1.35;color:#1D4ED8;font-weight:700;">Welcome to the Request Handling Management System!</h1>` +
    `</td></tr>` +
    `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 28px;text-align:center;">` +
    `<h2 style="margin:0;font-size:18px;line-height:1.35;color:#0f172a;font-weight:700;">Request Handling Management System</h2>` +
    `</td></tr>` +
    `<tr><td style="padding:32px;">` +
    `<p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Your password reset verification code is:</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td align="center" bgcolor="#1D4ED8" style="border-radius:8px;">` +
    `<div style="display:inline-block;padding:14px 32px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:6px;border-radius:8px;">${otp}</div>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">This code will expire in ${ttlSeconds} seconds.</p>` +
    `<p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">If you did not request a password reset, please ignore this email.</p>` +
    `</td></tr>` +
    `<tr><td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply to this email.</p>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`;
  if (mailer.isSmtpConfigured()) {
    try {
      // Fast-fail when the SMTP server is unreachable instead of hanging.
      await mailer.verifySmtp();
    } catch (err) {
      const kind = (err && err.message) || '';
      console.error('[PasswordResetOTP] SMTP verify failed:', kind);
      if (kind === 'SMTP_TIMEOUT' || (err && err.code === 'ETIMEDOUT')) throw new Error('SMTP_TIMEOUT');
      if (kind === 'SMTP_AUTH') throw new Error('SMTP_AUTH');
      throw new Error('SMTP_UNAVAILABLE');
    }
    try {
      const info = await mailer.sendMail({ to: toEmail, subject, text, html, ...(logoAttachment ? { attachments: [logoAttachment] } : {}) });
      console.log(`[PasswordResetOTP] Email sent to ${toEmail} via SMTP (messageId: ${info.messageId || 'n/a'})`);
      return { channel: 'smtp' };
    } catch (err) {
      const kind = (err && err.message) || '';
      console.error('[PasswordResetOTP] SMTP send failed:', kind);
      // Propagate a classified kind so the endpoint can return a clear message.
      if (['SMTP_TIMEOUT', 'SMTP_AUTH', 'SMTP_UNAVAILABLE', 'SMTP_NO_SUCH_USER'].includes(kind)) throw err;
      throw new Error('SMTP_UNAVAILABLE');
    }
  } else {
    console.log(`[PasswordResetOTP] SMTP not configured; using in-app fallback. From: ${fromAddress} To: ${toEmail} Subject: ${subject}\n${text}`);
  }
  try {
    const u = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [String(toEmail).toLowerCase()]);
    if (u.rows.length > 0) {
      notifyUser(u.rows[0].id, `Your password reset code is ${otp}. It expires in ${ttlSeconds} seconds.`,
        { type: 'password_reset_otp', title: 'Password Reset Code' });
    }
  } catch (e) { /* notification is best-effort */ }
  return { channel: 'in-app' };
}

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

// Lightweight in-memory rate limiting for the OTP endpoints (per key).
// Limits: OTP sends 5/hour + 2-minute resend cooldown; verifications 10/hour.
const otpRateState = new Map();
function otpRateLimit(key, maxHits, windowMs) {
  const now = Date.now();
  let entry = otpRateState.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, hits: 0 };
    otpRateState.set(key, entry);
  }
  entry.hits += 1;
  if (entry.hits > maxHits) return false;
  // Opportunistic cleanup so the map cannot grow without bound.
  if (otpRateState.size > 5000) {
    for (const [k, v] of otpRateState) {
      if (now - v.start > windowMs) otpRateState.delete(k);
    }
  }
  return true;
}

const OTP_TTL_SECONDS = 60;
const OTP_MAX_VERIFY_ATTEMPTS = 5;

async function findValidOtp(userId, otp) {
  const result = await pool.query(
    `SELECT id, otp_hash, expires_at, used_at, attempts
     FROM password_reset_otps
     WHERE user_id = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired', id: row.id };
  if (row.attempts >= OTP_MAX_VERIFY_ATTEMPTS) return { ok: false, reason: 'locked', id: row.id };
  if (hashOtp(String(otp).trim()) !== row.otp_hash) return { ok: false, reason: 'mismatch', id: row.id };
  return { ok: true, id: row.id };
}

// Step 1: verify the account is registered and verified, generate a secure
// 6-digit OTP, store only its hash with expiry, and send it. Distinct errors
// tell the user whether the account is missing or verification is incomplete.
app.post('/api/auth/forgot-password-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!otpRateLimit(`send:${ip}`, 20, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    if (!otpRateLimit(`sendemail:${email}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many reset requests for this email. Please try again later.' });
    }

    // Account must be registered AND verified before any reset OTP is issued.
    // No user row is created until signup email verification completes, so a
    // missing row means never registered — unless verification was started
    // but never finished (codes exist, none consumed).
    const userResult = await pool.query('SELECT id, name, email, approved FROM users WHERE LOWER(email) = $1', [email]);
    if (userResult.rows.length === 0) {
      const verifiedOnce = await pool.query(
        'SELECT id FROM email_verification_codes WHERE email = $1 AND used_at IS NOT NULL LIMIT 1',
        [email]
      );
      if (verifiedOnce.rows.length === 0) {
        const attempted = await pool.query(
          'SELECT id FROM email_verification_codes WHERE email = $1 LIMIT 1',
          [email]
        );
        if (attempted.rows.length > 0) {
          return res.status(400).json({ error: 'Account is not registered or email verification is incomplete.' });
        }
      }
      return res.status(404).json({ error: 'Account not registered.' });
    }
    const otpUser = userResult.rows[0];
    // Blocked / never-approved accounts are not eligible for password reset.
    if (otpUser.approved === false) {
      return res.status(400).json({ error: 'Account is not registered or email verification is incomplete.' });
    }
    {
      const user = otpUser;
      // Resend cooldown (matches the 60s frontend countdown): do not spam.
      const recent = await pool.query(
        `SELECT created_at FROM password_reset_otps
         WHERE user_id = $1 AND used_at IS NULL AND created_at > NOW() - INTERVAL '60 seconds'
         ORDER BY created_at DESC LIMIT 1`,
        [user.id]
      );
      if (recent.rows.length > 0) {
        const retryAfter = Math.max(1, 60 - Math.floor((Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000));
        return res.json({ message: 'If an account exists with this email, a verification code has been sent.', resent: false, retryAfter });
      }
      // Single-use protection: invalidate previously issued, unused OTPs.
      await pool.query('UPDATE password_reset_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      const otp = String(crypto.randomInt(100000, 1000000));
      const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
      const otpId = uuidv4();
      await pool.query(
        `INSERT INTO password_reset_otps (id, user_id, otp_hash, expires_at, created_by_ip, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [otpId, user.id, hashOtp(otp), expiresAt, ip]
      );
      auditLogin('password_reset_otp_requested', user.id, user.email, req);
      await logAuthActivity('password_reset_requested', user, req, { email, channel: 'otp' });
      const sendWithTimeout = (ms) => Promise.race([
        sendPasswordResetOtpEmail(user.email, user.name, otp, OTP_TTL_SECONDS, req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_TIMEOUT')), ms)),
      ]);
      try {
        await sendWithTimeout(25000);
      } catch (err) {
        // Do not leave an undeliverable OTP active; it must not count as an attempt.
        try { await pool.query('UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1', [otpId]); } catch (e) { /* ignore */ }
        const kind = (err && err.message) || '';
        if (kind === 'SMTP_TIMEOUT') return res.status(504).json({ error: 'The email service took too long to respond. Please try again.' });
        if (kind === 'SMTP_AUTH') return res.status(503).json({ error: 'Password reset email service is not configured correctly. Please contact the administrator.' });
        if (kind === 'SMTP_NO_SUCH_USER') return res.status(400).json({ error: 'Unable to send the email. Please check your registered email address and try again.' });
        return res.status(503).json({ error: 'Email service is temporarily unavailable. Please try again later.' });
      }
      return res.json({ message: 'Verification code sent to your email.', resent: true });
    }
  } catch (err) {
    console.error('Forgot password OTP error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Step 2: verify the OTP and expiry without consuming it.
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();
    if (!email || !otp) return res.status(400).json({ error: 'Email and code are required' });
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!otpRateLimit(`verify:${ip}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    const userResult = await pool.query('SELECT id, approved FROM users WHERE LOWER(email) = $1', [email]);
    if (userResult.rows.length === 0) return res.json({ valid: false });
    // No OTPs are issued to unregistered/unverified accounts; nothing to verify.
    if (userResult.rows[0].approved === false) return res.json({ valid: false });
    const check = await findValidOtp(userResult.rows[0].id, otp);
    if (!check.ok) {
      if (check.id && check.reason === 'mismatch') {
        await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [check.id]);
      }
      return res.json({ valid: false, reason: check.reason === 'mismatch' ? 'mismatch' : check.reason });
    }
    // The code was entered within its 60-second window. From here the user
    // may take as long as needed on the password step: lift the countdown by
    // extending this (already-verified) OTP, still single-use and consumed at
    // reset. Unverified codes keep the exact 60-second expiry.
    await pool.query("UPDATE password_reset_otps SET expires_at = NOW() + INTERVAL '30 minutes' WHERE id = $1", [check.id]);
    res.json({ valid: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Step 3: consume a valid OTP and set the new password (existing password rules).
app.post('/api/auth/reset-password-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();
    const { password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ error: 'Email, code and password are required' });
    }
    const pwResult = await pool.query("SELECT value FROM system_settings WHERE key = 'passwordLength'");
    const minLength = pwResult.rows.length > 0 ? parseInt(pwResult.rows[0].value) || 8 : 8;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    const userResult = await pool.query('SELECT id, email, approved FROM users WHERE LOWER(email) = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired code' });
    if (userResult.rows[0].approved === false) {
      return res.status(400).json({ error: 'Account is not registered or email verification is incomplete.' });
    }
    const userId = userResult.rows[0].id;
    const check = await findValidOtp(userId, otp);
    if (!check.ok) {
      if (check.id && check.reason === 'mismatch') {
        await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [check.id]);
      }
      if (check.reason === 'expired') return res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1, login_attempts = 0 WHERE id = $2', [hashedPassword, userId]);
    // Invalidate the OTP after successful reset (single-use).
    await pool.query('UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1', [check.id]);
    // Revoke existing sessions so the new password takes effect everywhere.
    await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
    auditLogin('password_reset_success', userId, userResult.rows[0].email, req);
    await logAuthActivity('password_reset_completed', { id: userId, email: userResult.rows[0].email }, req, { channel: 'otp' });
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password OTP error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ---- Registration email verification (separate from password-reset OTPs) ----
// A user row is NOT created until the mailbox is proven reachable: a code is
// mailed to the entered address and signup requires that code. SMTP delivery
// failure (e.g. unknown Gmail mailbox, 550) aborts with 503 and no account.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_VERIFY_TTL_SECONDS = OTP_TTL_SECONDS;
const EMAIL_VERIFY_MAX_ATTEMPTS = 5;

async function findValidEmailCode(emailLower, code) {
  const result = await pool.query(
    `SELECT id, code_hash, expires_at, used_at, attempts
     FROM email_verification_codes
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [emailLower]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'not_found' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired', id: row.id };
  if (row.attempts >= EMAIL_VERIFY_MAX_ATTEMPTS) return { ok: false, reason: 'locked', id: row.id };
  if (hashOtp(String(code).trim()) !== row.code_hash) return { ok: false, reason: 'mismatch', id: row.id };
  return { ok: true, id: row.id };
}

async function sendRegistrationVerificationEmail(toEmail, userName, code, req) {
  const { logoBlock, logoAttachment } = await getEmailLogoBlock(req);
  const subject = 'RHMS Email Verification Code';
  const text =
    `Request Handling Management System\n\n` +
    `Your email verification code is:\n\n` +
    `${code}\n\n` +
    `This code will expire in ${EMAIL_VERIFY_TTL_SECONDS} seconds.\n\n` +
    `If you did not request this verification, please ignore this email.`;
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">` +
    `<tr><td align="center">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">` +
    `<tr><td align="center" style="background-color:#ffffff;padding:36px 32px 8px;text-align:center;">` +
    logoBlock +
    `</td></tr>` +
    `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 8px;text-align:center;">` +
    `<h1 style="margin:0;font-size:22px;line-height:1.35;color:#1D4ED8;font-weight:700;">Welcome to the Request Handling Management System!</h1>` +
    `</td></tr>` +
    `<tr><td align="center" style="background-color:#ffffff;padding:8px 32px 28px;text-align:center;">` +
    `<h2 style="margin:0;font-size:18px;line-height:1.35;color:#0f172a;font-weight:700;">Request Handling Management System</h2>` +
    `</td></tr>` +
    `<tr><td style="padding:32px;">` +
    `<p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Your email verification code is:</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td align="center" bgcolor="#1D4ED8" style="border-radius:8px;">` +
    `<div style="display:inline-block;padding:14px 32px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:6px;border-radius:8px;">${code}</div>` +
    `</td></tr></table>` +
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">This code will expire in ${EMAIL_VERIFY_TTL_SECONDS} seconds.</p>` +
    `<p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">If you did not request this verification, please ignore this email.</p>` +
    `</td></tr>` +
    `<tr><td style="background-color:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">` +
    `<p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply to this email.</p>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`;
  if (!mailer.isSmtpConfigured()) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }
  try {
    await mailer.verifySmtp();
  } catch (err) {
    throw err;
  }
  await mailer.sendMail({ to: toEmail, subject, text, html, ...(logoAttachment ? { attachments: [logoAttachment] } : {}) });
}

// Step 1: validate details and mail a verification code. Creates NO user row.
app.post('/api/auth/request-email-verification', async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'This email address does not exist or cannot be verified. Please use a valid email address.' });
    }
    const pwResult = await pool.query("SELECT value FROM system_settings WHERE key = 'passwordLength'");
    const minLength = pwResult.rows.length > 0 ? parseInt(pwResult.rows[0].value) || 8 : 8;
    if (password.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
    }
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!otpRateLimit(`emailverify:${ip}`, 20, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    if (!otpRateLimit(`emailverify:${email}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many verification requests for this email. Please try again later.' });
    }
    const recent = await pool.query(
      `SELECT created_at FROM email_verification_codes
       WHERE email = $1 AND used_at IS NULL AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (recent.rows.length > 0) {
      const retryAfter = Math.max(1, 60 - Math.floor((Date.now() - new Date(recent.rows[0].created_at).getTime()) / 1000));
      return res.json({ message: 'Verification code sent.', resent: false, retryAfter });
    }
    await pool.query('UPDATE email_verification_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL', [email]);
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_SECONDS * 1000);
    const codeId = uuidv4();
    await pool.query(
      `INSERT INTO email_verification_codes (id, email, code_hash, expires_at, created_by_ip, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [codeId, email, hashOtp(code), expiresAt, ip]
    );
    const sendWithTimeout = (ms) => Promise.race([
      sendRegistrationVerificationEmail(email, name, code, req),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP_TIMEOUT')), ms)),
    ]);
    try {
      await sendWithTimeout(25000);
    } catch (err) {
      console.error('[EmailVerify] SMTP send failed for', email, ':', err.message);
      // The email was NOT delivered: remove the unsent code so a retry sends
      // fresh instead of hitting the resend cooldown and falsely reporting success.
      await pool.query('DELETE FROM email_verification_codes WHERE id = $1', [codeId]);
      const kind = (err && err.message) || '';
      if (kind === 'SMTP_TIMEOUT' || (err && err.code === 'ETIMEDOUT')) return res.status(504).json({ error: 'The email service took too long to respond. Please try again.' });
      if (kind === 'SMTP_AUTH') return res.status(503).json({ error: 'Email service is not configured correctly. Please contact the administrator.' });
      if (kind === 'SMTP_NOT_CONFIGURED') return res.status(503).json({ error: 'Email service is not configured. Please contact the administrator.' });
      if (kind === 'SMTP_NO_SUCH_USER') return res.status(400).json({ error: 'Unable to send the email. Please check your registered email address and try again.' });
      return res.status(503).json({ error: 'We could not send the verification code to this email address. Please check the email address and try again.' });
    }
    return res.json({ message: 'Verification code sent.', resent: true });
  } catch (err) {
    console.error('Request email verification error:', err);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Step 2: check the code without consuming it.
app.post('/api/auth/verify-email-code', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'This email address does not exist or cannot be verified. Please use a valid email address.' });
    }
    const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (!otpRateLimit(`emailcode:${ip}`, 30, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    const check = await findValidEmailCode(email, code);
    if (!check.ok) {
      if (check.id && check.reason === 'mismatch') {
        await pool.query('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = $1', [check.id]);
      }
      return res.json({ valid: false, reason: check.reason });
    }
    res.json({ valid: true });
  } catch (err) {
    console.error('Verify email code error:', err);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

// Users Routes
app.get('/api/users', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.company_name, u.language, u.approved, u.moderated, u.created_at,
        EXISTS(SELECT 1 FROM login_audit la WHERE la.action = 'signup' AND la.email = u.email) AS self_registered
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
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, company_name, language, approved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, name, email, hashedPassword, role || 'client', companyName || '', ['en', 'am'].includes(language) ? language : 'en', true]
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
    await logUserActivity('user_created', { id, name, email, role: role || 'client' }, req.user, req);
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
      const hashedPassword = await bcrypt.hash(password, 10);
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
    await logUserActivity('user_updated', { id: req.params.id, name, email, role }, req.user, req, { changes: { name, email, role, companyName, language } });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const doomed = existing.rows[0];
    const doomedEmail = String(doomed.email || '').trim().toLowerCase();
    // Preserve the ownership trail BEFORE nulling FKs so a later verified
    // re-registration with the same email can reclaim its own history.
    // Historical rows (requests/comments/attachments/activity) are never deleted.
    try {
      if (doomedEmail) {
        await pool.query(
          `UPDATE requests SET client_email = $2 WHERE client_id = $1 AND (client_email IS NULL OR client_email = '')`,
          [req.params.id, doomed.email]
        );
        await pool.query(
          `UPDATE comments SET author_email = $2 WHERE user_id = $1 AND (author_email IS NULL OR author_email = '')`,
          [req.params.id, doomed.email]
        );
      }
    } catch (e) { console.error('Failed to preserve ownership trail:', e.message); }

    await pool.query('UPDATE requests SET client_deleted = TRUE WHERE client_id = $1', [req.params.id]);
    await pool.query('UPDATE requests SET client_id = NULL WHERE client_id = $1', [req.params.id]);
    await pool.query('UPDATE requests SET assigned_to = NULL WHERE assigned_to = $1', [req.params.id]);
    await pool.query('UPDATE comments SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('UPDATE activity_log SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('UPDATE feedback SET user_id = NULL WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM user_groups WHERE user_id = $1', [req.params.id]);
    // Invalidate all sessions/tokens for the deleted user (rows cascade on user
    // delete, but revoke first so currently-valid JWTs are marked revoked).
    try {
      await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [req.params.id]);
      await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [req.params.id]);
      await pool.query('UPDATE password_reset_otps SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [req.params.id]);
    } catch (e) { console.error('Failed to revoke deleted-user sessions:', e.message); }
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    // Remember the deleted credentials so a later sign-in attempt reports that
    // the account no longer exists. Never blocks a fresh verified registration.
    try {
      await pool.query(
        `INSERT INTO deleted_accounts (email, name) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, deleted_at = NOW()`,
        [String(doomed.email || '').trim().toLowerCase(), doomed.name || null]
      );
    } catch (e) { console.error('Failed to record deleted account:', e.message); }
    await logUserActivity('user_deleted', { id: req.params.id }, req.user, req);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/users/:id/approve', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { approved } = req.body;
    const result = await pool.query('UPDATE users SET approved = $1, moderated = $1 WHERE id = $2 RETURNING *', [approved, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = mapUser(result.rows[0]);
    await logUserActivity(approved ? 'user_unblocked' : 'user_blocked', user, req.user, req);
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
      const hashedPassword = await bcrypt.hash(password, 10);
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
    await logUserActivity('profile_updated', user, req.user, req, { changes: { name, email, companyName, language, avatar: !!avatarPath, password: !!password } });
    if (password) {
      await logAuthActivity('password_changed', user, req);
    }
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
    await logActivity({ type: 'category_created', message: `Category "${name}" created`, userId: req.user.id, entityType: 'category', entityId: id, req });
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
    await logActivity({ type: 'category_updated', message: `Category "${name}" updated`, userId: req.user.id, entityType: 'category', entityId: req.params.id, req });
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
    await logActivity({ type: 'category_deleted', message: `Category deleted`, userId: req.user.id, entityType: 'category', entityId: req.params.id, severity: 'warning', req });
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
    await logActivity({ type: 'priority_created', message: `Priority "${name}" created`, userId: req.user.id, entityType: 'priority', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Statuses Routes
app.get('/api/statuses', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM statuses WHERE LOWER(name) <> 'reopened' ORDER BY sort_order, id`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/statuses/all', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM statuses WHERE LOWER(name) <> 'reopened' ORDER BY sort_order, id`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/statuses', authMiddleware, async (req, res) => {
  try {
    const { name, color } = req.body;
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Status name is required' });
    }
    const existing = await pool.query(
      `SELECT id FROM statuses WHERE LOWER(name) = LOWER($1)`,
      [trimmedName]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A status with this name already exists' });
    }
    const maxOrder = await pool.query(`SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM statuses`);
    const newOrder = (maxOrder.rows[0].max_order || 0) + 1;
    const id = 'status_' + Date.now();
    await pool.query(
      `INSERT INTO statuses (id, name, color, is_active, sort_order, is_system)
       VALUES ($1, $2, $3, TRUE, $4, FALSE)`,
      [id, trimmedName, color || '#6B7280', newOrder]
    );
    const result = await pool.query(`SELECT * FROM statuses WHERE id = $1`, [id]);
    await logActivity({ type: 'status_created', message: `Status "${trimmedName}" created`, userId: req.user.id, entityType: 'status', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/statuses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Status name is required' });
    }
    const existing = await pool.query(
      `SELECT id FROM statuses WHERE LOWER(name) = LOWER($1) AND id <> $2`,
      [trimmedName, id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A status with this name already exists' });
    }
    await pool.query(
      `UPDATE statuses SET name = $1, color = $2 WHERE id = $3`,
      [trimmedName, color || '#6B7280', id]
    );
    const result = await pool.query(`SELECT * FROM statuses WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Status not found' });
    }
    await logActivity({ type: 'status_updated', message: `Status "${trimmedName}" updated`, userId: req.user.id, entityType: 'status', entityId: id, req });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/statuses/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const statusCheck = await pool.query(`SELECT is_system FROM statuses WHERE id = $1`, [id]);
    if (statusCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Status not found' });
    }
    if (statusCheck.rows[0].is_system) {
      return res.status(403).json({ error: 'System statuses cannot be deleted' });
    }
    const requestCheck = await pool.query(`SELECT COUNT(*)::int AS count FROM requests WHERE status_id = $1`, [id]);
    if (requestCheck.rows[0].count > 0) {
      return res.status(409).json({ error: 'Cannot delete a status that is in use by requests' });
    }
    await pool.query(`DELETE FROM statuses WHERE id = $1`, [id]);
    await logActivity({ type: 'status_deleted', message: `Status deleted`, userId: req.user.id, entityType: 'status', entityId: id, severity: 'warning', req });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/statuses/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE statuses SET is_active = NOT is_active WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Status not found' });
    }
    await logActivity({ type: 'status_toggled', message: `Status ${result.rows[0].is_active ? 'activated' : 'deactivated'}: ${result.rows[0].name}`, userId: req.user.id, entityType: 'status', entityId: id, req });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/statuses/reorder', authMiddleware, async (req, res) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.query(`UPDATE statuses SET sort_order = $1 WHERE id = $2`, [i + 1, orderedIds[i]]);
    }
    res.json({ success: true });
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

    const { status, priority, category, search, startDate, endDate } = req.query;
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
    // Optional created_at window, used by dashboards to compare a status count
    // against the same scope one week earlier.
    if (startDate) {
      query += ` AND r.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND r.created_at < $${paramIndex++}`;
      params.push(endDate);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    const enriched = result.rows.map(r => ({
      id: r.id,
      subject: r.subject,
      description: r.description,
      clientId: r.client_id,
      categoryId: r.category_id,
      customCategory: r.custom_category || null,
      priorityId: r.priority_id,
      statusId: r.status_id,
      assignedTo: r.assigned_to,
      attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      clientDeleted: r.client_deleted,
      client: r.client_deleted ? { deleted: true } : (r.client_name ? { id: r.client_id, name: r.client_name, email: r.client_email, role: r.client_role, avatar: r.client_avatar, createdAt: r.client_created_at } : null),
      category: r.category_name ? { id: r.category_id, name: (r.custom_category || r.category_name), description: r.category_description, color: r.category_color, customCategory: (r.custom_category || null) } : (r.custom_category ? { id: r.category_id, name: r.custom_category, description: null, color: '#6B7280', customCategory: r.custom_category } : null),
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

    // Attach comments to each request so the client's messages panel can surface
    // recent comments without issuing a separate request per item.
    try {
      const reqIds = result.rows.map(r => r.id);
      if (reqIds.length > 0) {
        const commentsResult = await pool.query(`
          SELECT c.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar
          FROM comments c
          LEFT JOIN users u ON c.user_id = u.id
          WHERE c.request_id = ANY($1::text[])
          ORDER BY c.created_at ASC
        `, [reqIds]);
        const commentsByRequest = {};
        for (const c of commentsResult.rows) {
          if (!commentsByRequest[c.request_id]) commentsByRequest[c.request_id] = [];
          commentsByRequest[c.request_id].push({
            id: c.id,
            requestId: c.request_id,
            userId: c.user_id,
            content: c.content,
            createdAt: c.created_at,
            attachments: typeof c.attachments === 'string' ? JSON.parse(c.attachments) : (c.attachments || []),
            user: c.user_name ? { id: c.user_id, name: c.user_name, email: c.user_email, role: c.user_role, avatar: c.user_avatar } : null
          });
        }
        enriched.forEach(r => { r.comments = commentsByRequest[r.id] || []; });
      }
    } catch (e) {
      console.error('Load comments for requests error:', e.message);
    }
    await logActivity({ type: 'request_list_viewed', message: `Request list viewed`, userId: req.user.id, entityType: 'request', req });
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
        SELECT r.id, r.subject, r.description, r.created_at, r.client_deleted,
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

    await logSearchActivity(type, q, req.user, req, { totalResults: results.requests?.total + results.users?.total + results.groups?.total });
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
      customCategory: r.custom_category || null,
      priorityId: r.priority_id,
      statusId: r.status_id,
      assignedTo: r.assigned_to,
      attachments: typeof r.attachments === 'string' ? JSON.parse(r.attachments) : r.attachments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      clientDeleted: r.client_deleted,
      client: r.client_deleted ? { deleted: true } : (r.client_name ? { id: r.client_id, name: r.client_name, email: r.client_email, role: r.client_role, avatar: r.client_avatar, createdAt: r.client_created_at } : null),
      category: r.category_name ? { id: r.category_id, name: (r.custom_category || r.category_name), description: r.category_description, color: r.category_color, customCategory: (r.custom_category || null) } : (r.custom_category ? { id: r.category_id, name: r.custom_category, description: null, color: '#6B7280', customCategory: r.custom_category } : null),
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
    await logRequestActivity('viewed', { id: req.params.id }, req.user, req);
    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    // Blocked users (approved = false) cannot submit new requests. Admins are
    // exempt so they can still create requests on behalf of clients.
    if (req.user.role !== 'admin' && !req.user.approved) {
      return res.status(403).json({ error: 'Your account is blocked. You cannot submit requests.' });
    }
    const { subject, description, categoryId, priorityId, attachments, customCategory } = req.body;
    if (!subject || !subject.trim() || !description || !description.trim() || !categoryId) {
      return res.status(400).json({ error: 'Please fill all required fields' });
    }
    // Map the "Other Categories" pseudo-option to the real "Other" category (id 8)
    // so the FK stays valid while preserving existing categories/workflow.
    let effectiveCategoryId = categoryId;
    if (categoryId === 'other-categories') effectiveCategoryId = '8';
    const customCategoryValue = (effectiveCategoryId === '8' && customCategory && String(customCategory).trim())
      ? String(customCategory).trim()
      : null;
    const countResult = await pool.query("SELECT nextval('requests_id_seq') AS next_num");
    const nextNum = parseInt(countResult.rows[0].next_num);
    const id = `REQ-2024-${String(nextNum).padStart(5, '0')}`;
    const clientId = req.user.role === 'client' ? req.user.id : req.body.clientId;
    const now = new Date().toISOString();
    // Record the owner's verified email for future reclaim after deletion.
    let clientEmail = '';
    try {
      if (req.user.role === 'client') {
        clientEmail = req.user.email || '';
      } else if (clientId) {
        const ownerRow = await pool.query('SELECT email FROM users WHERE id = $1', [clientId]);
        if (ownerRow.rows.length > 0) clientEmail = ownerRow.rows[0].email || '';
      }
    } catch (e) { /* best-effort */ }

    const defResult = await pool.query("SELECT value FROM system_settings WHERE key IN ('defaultStatus', 'defaultPriority')");
    const defMap = {};
    for (const row of defResult.rows) defMap[row.key] = row.value;
    const defaultStatusId = defMap.defaultStatus || '1';
    const defaultPriorityId = defMap.defaultPriority || '2';

    await pool.query(
      'INSERT INTO requests (id, subject, description, client_id, client_email, category_id, priority_id, status_id, attachments, created_at, updated_at, custom_category) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [id, subject, description, clientId, clientEmail || '', effectiveCategoryId, priorityId || defaultPriorityId, defaultStatusId, JSON.stringify(attachments || []), now, now, customCategoryValue]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'created', id, req.user.id, 'New request created', now]
    );
    await logRequestActivity('created', { id, subject }, req.user, req);

    // Store client's groups for group-based visibility
    const clientGroups = await pool.query('SELECT group_id FROM user_groups WHERE user_id = $1', [clientId]);
    if (clientGroups.rows.length > 0) {
      const groupValues = clientGroups.rows.map(r => `('${id}', '${r.group_id}')`).join(',');
      await pool.query(`INSERT INTO request_groups (request_id, group_id) VALUES ${groupValues} ON CONFLICT DO NOTHING`);
    }

    // Real-time notification
    notifyAdmins('New request created', { type: 'request_created', requestId: id, subject, userId: req.user.id, userName: req.user.name });

    res.status(201).json({ id, subject, description, clientId, categoryId: effectiveCategoryId, customCategory: customCategoryValue, priorityId: priorityId || '2', statusId: '1', assignedTo: null, attachments: attachments || [], createdAt: now, updatedAt: now });
  } catch (err) {
    console.error('Create request error:', err.message);
    res.status(500).json({ error: 'Failed to create request: ' + err.message });
  }
});

// True when the request's current Closed/Rejected state was set by a Client
// (derived from the activity log, no schema change). Used to make
// client-closed requests read-only for Admin/Developer/Escalation staff.
async function closedByClient(requestId) {
  const closer = await pool.query(
    `SELECT u.role FROM activity_log a JOIN users u ON u.id = a.user_id
     WHERE a.request_id = $1 AND a.type = 'status_update'
       AND (a.message LIKE '%to Closed' OR a.message LIKE '%to Rejected')
     ORDER BY a.created_at DESC LIMIT 1`,
    [requestId]
  );
  return closer.rows.length > 0 && closer.rows[0].role === 'client';
}

app.put('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const { subject, description, categoryId, priorityId, statusId, assignedTo, assignedGroup, attachments } = req.body;
    const now = new Date().toISOString();

    const existing = await pool.query('SELECT * FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    // A Resolved request Closed/Rejected by the Client is read-only for staff:
    // Admin, Developer and Escalation Team can view it but must not change it.
    if ((statusId || assignedTo !== undefined || assignedGroup !== undefined) && req.user.role !== 'client' &&
        (existing.rows[0].status_id === '6' || existing.rows[0].status_id === '8') &&
        await closedByClient(req.params.id)) {
      return res.status(403).json({ error: 'This request was closed by the client and is read-only.' });
    }

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
      await logRequestActivity('status_changed', { id: req.params.id }, req.user, req, { oldStatus: oldStatusName, newStatus: newStatusName });
      const lifecycleMap = { '5': 'resolved', '6': 'closed', '8': 'rejected', '9': 'escalated', '7': 'reopened' };
      const lifecycleAction = lifecycleMap[statusId];
      if (lifecycleAction) {
        await logRequestActivity(lifecycleAction, { id: req.params.id }, req.user, req, { oldStatus: oldStatusName, newStatus: newStatusName });
      }
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
      await logRequestActivity('assigned', { id: req.params.id }, req.user, req, { assigneeName: assigneeResult.rows[0]?.name || 'Unknown', assigneeId: assignedTo });
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

    const changes = [];
    if (subject && subject !== existing.rows[0].subject) changes.push('subject');
    if (description && description !== existing.rows[0].description) changes.push('description');
    if (categoryId && categoryId !== existing.rows[0].category_id) { changes.push('category'); await logRequestActivity('category_changed', { id: req.params.id }, req.user, req, { from: existing.rows[0].category_id, to: categoryId }); }
    if (priorityId && priorityId !== existing.rows[0].priority_id) { changes.push('priority'); await logRequestActivity('priority_changed', { id: req.params.id }, req.user, req, { from: existing.rows[0].priority_id, to: priorityId }); }
    if (attachments !== undefined) changes.push('attachments');
    if (assignedGroup && assignedGroup !== existing.rows[0].assigned_group) { await logRequestActivity('assigned_group_changed', { id: req.params.id }, req.user, req, { from: existing.rows[0].assigned_group, to: assignedGroup }); }
    if (changes.length > 0) {
      await logRequestActivity('updated', { id: req.params.id }, req.user, req, { changes });
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

    // A request Closed/Rejected by the Client cannot be claimed by staff.
    if ((existing.rows[0].status_id === '6' || existing.rows[0].status_id === '8') &&
        await closedByClient(requestId)) {
      return res.status(403).json({ error: 'This request was closed by the client and is read-only.' });
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
    await logRequestActivity('claimed', { id: requestId }, req.user, req, { assigneeName });

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

app.delete('/api/requests/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id, client_id, status_id FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

    if (req.user.role !== 'admin') {
      const canDelete = req.user.role === 'client'
        && existing.rows[0].client_id === req.user.id
        && existing.rows[0].status_id === '1';
      if (!canDelete) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    await pool.query('DELETE FROM comments WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM activity_log WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM feedback WHERE request_id = $1', [req.params.id]);
    await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
    await logRequestActivity('deleted', { id: req.params.id }, req.user, req);
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

    // Support and developer can only comment on their own assigned requests
    if ((req.user.role === 'support' || req.user.role === 'developer') && existing.rows[0].assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Access denied - you can only modify requests assigned to you' });
    }

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
      'INSERT INTO comments (id, request_id, user_id, author_email, content, attachments, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, req.params.id, req.user.id, req.user.email || '', content, JSON.stringify(attachments || []), now]
    );

    await pool.query(
      'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), 'comment', req.params.id, req.user.id, 'New comment on request', now]
    );
    await logRequestActivity('comment_added', { id: req.params.id }, req.user, req, { commentId: id });

    // Real-time notification
    const clientId = existing.rows[0].client_id;
    const assignedTo = existing.rows[0].assigned_to;
    notifyAdmins(`New comment on Request #${req.params.id} by ${req.user.name}`, { type: 'comment', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
    // Notify the client (if comment is not from the client)
    if (clientId && clientId !== req.user.id) {
      notifyUser(clientId, `New comment on your request #${req.params.id} by ${req.user.name}`, { type: 'comment', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
    }
    // Notify the assigned developer/support (if comment is not from them)
    if (assignedTo && assignedTo !== req.user.id) {
      notifyUser(assignedTo, `New comment on Request #${req.params.id} by ${req.user.name}`, { type: 'comment', requestId: req.params.id, userId: req.user.id, userName: req.user.name });
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
    await logRequestActivity('feedback_submitted', { id: req.params.id }, req.user, req, { rating, comment });
    const reqResult = await pool.query('SELECT subject FROM requests WHERE id = $1', [req.params.id]);
    notifyAdmins(`New feedback on Request #${req.params.id} by ${req.user.name}`, { type: 'feedback', requestId: req.params.id, userId: req.user.id, userName: req.user.name, subject: reqResult.rows[0]?.subject });
    res.status(201).json({ rating, comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/feedback', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.name AS user_name, u.avatar AS user_avatar, r.subject AS request_subject
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
    await logActivity({ type: 'feedback_deleted', message: `Feedback deleted`, userId: req.user.id, entityType: 'feedback', entityId: req.params.id, severity: 'warning', req });
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
    m.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: `File too large. Maximum size is ${maxMB}MB` });
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      await logActivity({ type: 'file_uploaded', message: `File uploaded: ${req.file.originalname}`, userId: req.user.id, entityType: 'file', details: { filename: req.file.filename, size: req.file.size, mimetype: req.file.mimetype }, req });
      res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Dashboard Stats
// Render an ISO 'YYYY-MM-DD' day as a short axis label without timezone drift
const formatDayLabel = (isoDate) => {
  const [y, m, d] = String(isoDate).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Builds the WHERE fragment that limits requests to what the signed-in user is
// allowed to see. Kept at module scope so the stats endpoint and the trends
// endpoint can never drift apart on permissions.
const buildRequestScopeWhere = (req, startIndex = 1) => {
  let clause = 'WHERE 1=1';
  const clauseParams = [];
  let i = startIndex;

  if (req.user.role === 'client') {
    clause += ` AND r.client_id = $${i++}`;
    clauseParams.push(req.user.id);
  }
  if (req.user.role === 'developer' || req.user.role === 'support') {
    const myRequests = req.query.myRequests === 'true';
    if (myRequests) {
      clause += ` AND r.assigned_to = $${i++}`;
      clauseParams.push(req.user.id);
    } else {
      clause += ` AND (r.assigned_to = $${i++} OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $${i++})`;
      if (req.user.role === 'support') {
        clause += ` OR r.status_id = '9'`;
      }
      clause += `)`;
      clauseParams.push(req.user.id, req.user.id);
    }
  }
  return { clause, params: clauseParams };
};

// Real week-over-week counts taken from stored request history: the current
// 7-day window versus the 7 days before it. A previous-week baseline of zero
// yields 0% rather than an invented jump.
const getWeeklyStatusCounts = async (scope, now = new Date()) => {
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 7);
  const previousStart = new Date(now);
  previousStart.setDate(previousStart.getDate() - 14);

  const runWindow = async (from, to) => {
    const windowParams = [...scope.params];
    const where = `${scope.clause} AND r.created_at >= $${windowParams.length + 1} AND r.created_at < $${windowParams.length + 2}`;
    windowParams.push(from.toISOString(), to.toISOString());
    const result = await pool.query(
      `SELECT r.status_id, COUNT(*) as count FROM requests r ${where} GROUP BY r.status_id`,
      windowParams
    );
    const map = {};
    result.rows.forEach(row => { map[row.status_id] = parseInt(row.count); });
    return map;
  };

  const [currentMap, previousMap] = await Promise.all([
    runWindow(currentStart, now),
    runWindow(previousStart, currentStart)
  ]);

  const sum = (map) => Object.values(map).reduce((total, n) => total + n, 0);
  return { currentMap, previousMap, currentTotal: sum(currentMap), previousTotal: sum(previousMap) };
};

const weeklyChangePercent = (currentCount, previousCount) => {
  if (!(previousCount > 0)) return 0;
  return Number((((Number(currentCount) || 0) - previousCount) / previousCount * 100).toFixed(1));
};

// Lightweight per-status week-over-week series for the role dashboards that
// build their own stat cards from the requests list.
app.get('/api/dashboard/trends', authMiddleware, async (req, res) => {
  try {
    const scope = buildRequestScopeWhere(req, 1);
    const { currentMap, previousMap, currentTotal, previousTotal } = await getWeeklyStatusCounts(scope);

    const statusesResult = await pool.query('SELECT * FROM statuses ORDER BY id');
    const byStatus = statusesResult.rows
      .filter(s => s.name.toLowerCase() !== 'reopened')
      .map(s => {
        const thisWeek = currentMap[s.id] || 0;
        const lastWeek = previousMap[s.id] || 0;
        return {
          id: s.id,
          name: s.name,
          color: s.color,
          is_active: s.is_active,
          thisWeekCount: thisWeek,
          lastWeekCount: lastWeek,
          changePercent: weeklyChangePercent(thisWeek, lastWeek)
        };
      });

    res.json({
      byStatus,
      thisWeekTotal: currentTotal,
      lastWeekTotal: previousTotal,
      changePercent: weeklyChangePercent(currentTotal, previousTotal)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const currentScope = buildRequestScopeWhere(req, 1);
    const whereClause = currentScope.clause;
    const params = currentScope.params;

    const totalResult = await pool.query(`SELECT COUNT(*) FROM requests r ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0].count);

    const statusCounts = await pool.query(
      `SELECT r.status_id, COUNT(*) as count FROM requests r ${whereClause} GROUP BY r.status_id`, params
    );
    const statusMap = {};
    statusCounts.rows.forEach(row => { statusMap[row.status_id] = parseInt(row.count); });

    const { currentMap: thisWeekStatusMap, previousMap: lastWeekStatusMap, currentTotal: thisWeekTotal, previousTotal: lastWeekTotal } =
      await getWeeklyStatusCounts(currentScope);

    const open = statusMap['1'] || 0;
    const assigned = statusMap['2'] || 0;
    const inProgress = statusMap['3'] || 0;
    const waiting = statusMap['4'] || 0;
    const resolved = statusMap['5'] || 0;
    const closed = statusMap['6'] || 0;
    const escalated = statusMap['9'] || 0;
    const rejected = statusMap['8'] || 0;

    const statusesResult = await pool.query('SELECT * FROM statuses ORDER BY id');
    const statuses = statusesResult.rows.filter(s => s.name.toLowerCase() !== 'reopened');
    const byStatus = statuses.map(s => {
      const currentCount = statusMap[s.id] || 0;
      const thisWeekCount = thisWeekStatusMap[s.id] || 0;
      const lastWeekCount = lastWeekStatusMap[s.id] || 0;
      return {
        ...s,
        count: currentCount,
        thisWeekCount,
        lastWeekCount,
        changePercent: weeklyChangePercent(thisWeekCount, lastWeekCount),
        percentage: total > 0 ? ((currentCount / total) * 100).toFixed(1) : 0
      };
    });

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

    // Daily created/resolved/closed series across the requested window.
    // `?days=all` stretches the window back to the oldest request so the whole
    // history is charted; a numeric value plots that many days ending today.
    // Either way a single statement fills every day in the range, so days without
    // activity render as 0 instead of collapsing the x-axis spacing.
    const daysParam = params.length + 1;
    const requestedDays = String(req.query.days ?? '30').toLowerCase();
    const todayResult = await pool.query('SELECT CURRENT_DATE::text AS today');
    const todayIso = todayResult.rows[0].today;
    let rangeDays = null;
    let startDay;
    if (requestedDays === 'all') {
      const oldestResult = await pool.query('SELECT MIN(created_at)::date::text AS oldest FROM requests');
      startDay = oldestResult.rows[0].oldest || todayIso;
    } else {
      rangeDays = Math.min(Math.max(parseInt(requestedDays, 10) || 30, 1), 365);
      const start = new Date(`${todayIso}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() - (rangeDays - 1));
      startDay = start.toISOString().slice(0, 10);
    }
    if (startDay > todayIso) startDay = todayIso;

    const dailyResult = await pool.query(
      `WITH span AS (
         SELECT generate_series($${daysParam}::date, CURRENT_DATE, INTERVAL '1 day')::date AS day
       ),
       created AS (
         SELECT r.created_at::date AS day, COUNT(*) AS count
         FROM requests r
         ${whereClause} AND r.created_at::date >= $${daysParam}::date
         GROUP BY 1
       ),
       activity AS (
         SELECT r.updated_at::date AS day,
                COUNT(*) FILTER (WHERE r.status_id = '5') AS resolved,
                COUNT(*) FILTER (WHERE r.status_id = '6') AS closed
         FROM requests r
         ${whereClause}
           AND r.status_id IN ('5', '6')
           AND r.updated_at::date >= $${daysParam}::date
         GROUP BY 1
       )
       SELECT span.day::text AS day,
              COALESCE(created.count, 0) AS created,
              COALESCE(activity.resolved, 0) AS resolved,
              COALESCE(activity.closed, 0) AS closed
       FROM span
       LEFT JOIN created ON created.day = span.day
       LEFT JOIN activity ON activity.day = span.day
       ORDER BY span.day`,
      [...params, startDay]
    );

    const dailyData = dailyResult.rows.map(row => ({
      date: formatDayLabel(row.day),
      day: row.day,
      created: parseInt(row.created) || 0,
      resolved: parseInt(row.resolved) || 0,
      closed: parseInt(row.closed) || 0
    }));

    await logActivity({ type: 'dashboard_viewed', message: `Dashboard viewed`, userId: req.user.id, entityType: 'dashboard', req });
    res.json({
      total,
      open,
      assigned,
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
      monthlyData: await (async () => {
        const monthlyResult = await pool.query(
          `SELECT TO_CHAR(DATE_TRUNC('month', r.created_at), 'YYYY-MM') AS month,
                 COUNT(*) FILTER (WHERE r.status_id != '6') AS created,
                 COUNT(*) FILTER (WHERE r.status_id = '5') AS resolved,
                 COUNT(*) FILTER (WHERE r.status_id = '6') AS closed
          FROM requests r
          GROUP BY 1
          ORDER BY 1`
        );
        return monthlyResult.rows.map(row => ({
          month: row.month,
          created: parseInt(row.created) || 0,
          resolved: parseInt(row.resolved) || 0,
          closed: parseInt(row.closed) || 0
        }));
      })(),
      rangeDays,
      totalThisWeek: thisWeekTotal,
      totalLastWeek: lastWeekTotal,
      totalChangePercent: weeklyChangePercent(thisWeekTotal, lastWeekTotal),
      openLastWeek: lastWeekStatusMap['1'] || 0,
      assignedLastWeek: lastWeekStatusMap['2'] || 0,
      inProgressLastWeek: lastWeekStatusMap['3'] || 0,
      waitingLastWeek: lastWeekStatusMap['4'] || 0,
      resolvedLastWeek: lastWeekStatusMap['5'] || 0,
      closedLastWeek: lastWeekStatusMap['6'] || 0,
      escalatedLastWeek: lastWeekStatusMap['9'] || 0,
      rejectedLastWeek: lastWeekStatusMap['8'] || 0
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

    await logActivity({ type: 'performance_viewed', message: `Performance dashboard viewed`, userId: req.user.id, entityType: 'dashboard', req });
    res.json({ labels, byCompany, byDeveloper, companyStats, developerStats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Escalation Performance
// Read-only aggregate of how escalated requests were handled. An "escalated
// request" is any request that entered the 'Escalated' status at some point:
// the transition is recorded in activity_log as a 'status_update' whose message
// ends in "to Escalated" (a request can leave that status and be resolved, so the
// current status alone is not enough to identify escalations). Requests that sit
// in the 'Escalated' status without a matching log row (e.g. seeded/imported data)
// are folded in as a fallback.
// 'Resolved' and 'Closed' count as resolved; every other status is still pending.
// There is no resolved_at column on requests, so average resolution time is
// measured from the first escalation to the request's last update, which is when
// a status change to Resolved/Closed writes updated_at.
// The same response also carries two additive breakdowns over read-only data:
//  - `team`: the same escalations grouped by the Support/Escalation member the
//    request is assigned to, using the identical escalations CTE, 'Resolved' /
//    'Closed' rule and range filter as the aggregate, so member rows sum exactly
//    to the aggregate totals.
//  - `developers`: per-developer assigned/resolved work and resolution time,
//    restricted to the developer and support roles.
// A missing or non-numeric `days` means "all time".
app.get('/api/dashboard/escalation-performance', authMiddleware, async (req, res) => {
  try {
    const parsedDays = parseInt(req.query.days, 10);
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : null;

    // Per-developer workload, taken from the same request/assignee/status joins
    // the rest of the performance endpoint uses. Restricted to the developer
    // role only, so Developer Performance stays separate from the Escalation
    // (Support) Team performance computed below: a resolved request counts
    // toward the performance of the team its assignee belongs to. Grouping by
    // user id (not just name) keeps same-named users from being merged.
    const devResult = await pool.query(`
      SELECT
        u.id AS id,
        u.name AS name,
        u.role AS role,
        COUNT(*)::int AS assigned,
        COUNT(*) FILTER (WHERE s.name IN ('Resolved', 'Closed'))::int AS resolved,
        COUNT(*) FILTER (WHERE s.name IN ('New', 'Assigned', 'In Progress', 'Waiting for Client'))::int AS in_progress,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 3600.0)
          FILTER (WHERE s.name IN ('Resolved', 'Closed') AND r.updated_at >= r.created_at)
          AS avg_resolution_hours
      FROM requests r
      JOIN users u ON r.assigned_to = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE u.role = 'developer'
        AND ($1::int IS NULL OR r.created_at::date >= (CURRENT_DATE - ($1::int || ' days')::interval))
      GROUP BY u.id, u.name, u.role
      ORDER BY assigned DESC, u.name
    `, [days]);

    const developers = devResult.rows.map(row => {
      const assigned = row.assigned || 0;
      const resolved = row.resolved || 0;
      const inProgress = row.in_progress || 0;
      return {
        id: row.id || null,
        name: row.name,
        role: row.role || null,
        assigned,
        resolved,
        inProgress,
        successRate: assigned ? Math.round((resolved / assigned) * 1000) / 10 : 0,
        avgResolutionHours: row.avg_resolution_hours === null || row.avg_resolution_hours === undefined
          ? null
          : Math.round(parseFloat(row.avg_resolution_hours) * 100) / 100
      };
    });

    const result = await pool.query(`
      WITH escalations AS (
        SELECT al.request_id, MIN(al.created_at) AS escalated_at
        FROM activity_log al
        WHERE al.type = 'status_update'
          AND al.message LIKE '%to Escalated'
          AND al.request_id IS NOT NULL
        GROUP BY al.request_id
        UNION ALL
        SELECT r.id, r.updated_at
        FROM requests r
        WHERE r.status_id = '9'
          AND NOT EXISTS (
            SELECT 1 FROM activity_log al
            WHERE al.request_id = r.id
              AND al.type = 'status_update'
              AND al.message LIKE '%to Escalated'
          )
      )
      SELECT
        COUNT(*)::int AS total_escalated,
        COUNT(*) FILTER (WHERE s.name IN ('Resolved', 'Closed'))::int AS resolved_escalated,
        COUNT(*) FILTER (WHERE s.name IS NULL OR s.name NOT IN ('Resolved', 'Closed'))::int AS pending_escalated,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - e.escalated_at)) / 3600.0)
          FILTER (WHERE s.name IN ('Resolved', 'Closed') AND r.updated_at >= e.escalated_at)
          AS avg_resolution_hours
      FROM escalations e
      JOIN requests r ON r.id = e.request_id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE ($1::int IS NULL OR e.escalated_at >= NOW() - ($1::int || ' days')::interval)
    `, [days]);

    const row = result.rows[0] || {};
    const totalEscalated = row.total_escalated || 0;
    const resolvedEscalated = row.resolved_escalated || 0;
    const pendingEscalated = row.pending_escalated || 0;
    const avgResolutionHours = row.avg_resolution_hours === null || row.avg_resolution_hours === undefined
      ? null
      : Math.round(parseFloat(row.avg_resolution_hours) * 100) / 100;

    // Per-team-member breakdown of escalations handled by the Escalation
    // (Support) team only: same escalations CTE / range filter as the aggregate
    // above, but restricted to assignees with users.role = 'support', using
    // their existing users.name. Developers, other roles and unassigned
    // requests are excluded here by design.
    const teamResult = await pool.query(`
      WITH escalations AS (
        SELECT al.request_id, MIN(al.created_at) AS escalated_at
        FROM activity_log al
        WHERE al.type = 'status_update'
          AND al.message LIKE '%to Escalated'
          AND al.request_id IS NOT NULL
        GROUP BY al.request_id
        UNION ALL
        SELECT r.id, r.updated_at
        FROM requests r
        WHERE r.status_id = '9'
          AND NOT EXISTS (
            SELECT 1 FROM activity_log al
            WHERE al.request_id = r.id
              AND al.type = 'status_update'
              AND al.message LIKE '%to Escalated'
          )
      )
      SELECT
        r.assigned_to AS user_id,
        u.name AS name,
        u.role AS role,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.name IN ('Resolved', 'Closed'))::int AS resolved,
        COUNT(*) FILTER (WHERE s.name IS NULL OR s.name NOT IN ('Resolved', 'Closed'))::int AS pending,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - e.escalated_at)) / 3600.0)
          FILTER (WHERE s.name IN ('Resolved', 'Closed') AND r.updated_at >= e.escalated_at)
          AS avg_resolution_hours
      FROM escalations e
      JOIN requests r ON r.id = e.request_id
      JOIN users u ON u.id = r.assigned_to AND u.role = 'support'
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE ($1::int IS NULL OR e.escalated_at >= NOW() - ($1::int || ' days')::interval)
      GROUP BY r.assigned_to, u.name, u.role
      ORDER BY total DESC, name NULLS LAST
    `, [days]);

    const team = teamResult.rows.map(r => {
      const total = r.total || 0;
      return {
        userId: r.user_id || null,
        name: r.name || null,
        role: r.role || null,
        total,
        resolved: r.resolved || 0,
        pending: r.pending || 0,
        successRate: total ? Math.round((r.resolved || 0) / total * 1000) / 10 : 0,
        avgResolutionHours: r.avg_resolution_hours === null || r.avg_resolution_hours === undefined
          ? null
          : Math.round(parseFloat(r.avg_resolution_hours) * 100) / 100
      };
    });

    await logActivity({ type: 'escalation_performance_viewed', message: `Escalation performance viewed`, userId: req.user.id, entityType: 'dashboard', req });
    res.json({
      rangeDays: days,
      metrics: {
        totalEscalated,
        resolvedEscalated,
        pendingEscalated,
        avgResolutionHours,
        successRate: totalEscalated ? Math.round((resolvedEscalated / totalEscalated) * 1000) / 10 : 0
      },
      team,
      developers
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Activity Log
app.get('/api/activity', authMiddleware, async (req, res) => {
  try {
    const { type, entityType, severity, userId, requestId, search, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(limit)));

    let query = `
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar, u.created_at as user_created_at,
        r.subject as request_subject
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN requests r ON al.request_id = r.id
    `;
    const params = [];
    let whereClause = '';
    const conditions = [];

    if (req.user.role === 'client') {
      conditions.push(`r.client_id = $${params.length + 1}`);
      params.push(req.user.id);
    } else if (req.user.role !== 'admin') {
      conditions.push(`(r.assigned_to = $${params.length + 1} OR EXISTS (SELECT 1 FROM request_groups rg INNER JOIN user_groups ug ON rg.group_id = ug.group_id WHERE rg.request_id = r.id AND ug.user_id = $${params.length + 1})`);
      if (req.user.role === 'support') {
        conditions[conditions.length - 1] += ` OR r.status_id = '9'`;
      }
      conditions[conditions.length - 1] += `)`;
      params.push(req.user.id);
    }

    if (type) {
      conditions.push(`al.type = $${params.length + 1}`);
      params.push(type);
    }
    if (entityType) {
      conditions.push(`al.entity_type = $${params.length + 1}`);
      params.push(entityType);
    }
    if (severity) {
      conditions.push(`al.severity = $${params.length + 1}`);
      params.push(severity);
    }
    if (userId) {
      conditions.push(`al.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    if (requestId) {
      conditions.push(`al.request_id = $${params.length + 1}`);
      params.push(requestId);
    }
    if (search) {
      conditions.push(`(al.message ILIKE $${params.length + 1} OR u.name ILIKE $${params.length + 1} OR r.subject ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (startDate) {
      conditions.push(`al.created_at >= $${params.length + 1}`);
      params.push(startDate);
    }
    if (endDate) {
      conditions.push(`al.created_at <= $${params.length + 1}`);
      params.push(endDate);
    }

    if (conditions.length > 0) {
      whereClause = ' WHERE ' + conditions.join(' AND ');
    }

    query += whereClause;
    query += ' ORDER BY al.created_at DESC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Math.min(100, Math.max(1, parseInt(limit))), offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN requests r ON al.request_id = r.id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2);

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams)
    ]);

    const enriched = result.rows.map(a => ({
      id: a.id,
      type: a.type,
      requestId: a.request_id,
      userId: a.user_id,
      message: a.message,
      createdAt: a.created_at,
      entityType: a.entity_type,
      entityId: a.entity_id,
      ipAddress: a.ip_address,
      userAgent: a.user_agent,
      details: a.details,
      severity: a.severity,
      user: a.user_name ? { id: a.user_id, name: a.user_name, email: a.user_email, role: a.user_role, avatar: a.user_avatar, createdAt: a.user_created_at } : null,
      request: a.request_subject ? { id: a.request_id, subject: a.request_subject } : null
    }));

    await logActivity({ type: 'activity_log_viewed', message: `Activity log viewed`, userId: req.user.id, entityType: 'activity_log', req });
    res.json({
      activities: enriched,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(parseInt(countResult.rows[0].total) / parseInt(limit))
      }
    });
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
    await logActivity({ type: 'activity_cleared', message: `Activity log cleared for request`, userId: req.user.id, entityType: 'activity_log', entityId: req.params.id, severity: 'warning', req });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear activity log' });
  }
});

app.delete('/api/activity', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM activity_log');
    await logActivity({ type: 'activity_cleared', message: `All activity log cleared`, userId: req.user.id, entityType: 'activity_log', severity: 'critical', req });
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
      entityType: a.entity_type,
      entityId: a.entity_id,
      ipAddress: a.ip_address,
      userAgent: a.user_agent,
      details: a.details,
      severity: a.severity,
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
      WHERE LOWER(s.name) <> 'reopened'
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
      SELECT r.id, r.subject, r.created_at, r.client_deleted, u.name AS client_name, u.avatar AS client_avatar, c.name AS category_name, c.color AS category_color, p.name AS priority_name
      FROM requests r
      LEFT JOIN users u ON r.client_id = u.id
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN priorities p ON r.priority_id = p.id
      ORDER BY r.created_at DESC LIMIT 10
    `);

    const userPerformanceResult = await pool.query(`
      SELECT u.id, u.name, u.role, u.avatar,
        COUNT(r.id) AS total_assigned,
        COUNT(CASE WHEN s.name = 'Resolved' OR s.name = 'Closed' THEN 1 END) AS resolved,
        COUNT(CASE WHEN s.name = 'In Progress' THEN 1 END) AS in_progress,
        COUNT(CASE WHEN s.name = 'New' OR s.name = 'Assigned' THEN 1 END) AS pending
      FROM users u
      LEFT JOIN requests r ON r.assigned_to = u.id
      LEFT JOIN statuses s ON r.status_id = s.id
      WHERE u.role IN ('developer', 'support')
      GROUP BY u.id, u.name, u.role, u.avatar
      ORDER BY resolved DESC
    `);

    await logActivity({ type: 'dashboard_viewed', message: `Dashboard viewed`, userId: req.user.id, entityType: 'dashboard', req });
    await logActivity({ type: 'report_viewed', message: `Report viewed`, userId: req.user.id, entityType: 'report', req });
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
    await logGroupActivity('group_created', { id, name }, req.user, req);
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
    await logGroupActivity('group_updated', { id: req.params.id, name }, req.user, req);
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
    await logGroupActivity('group_deleted', { id: req.params.id }, req.user, req);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Group Members Routes
app.get('/api/groups/:id/members', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.avatar, u.approved
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
    await logGroupActivity('member_added', { id: req.params.id }, req.user, req, { memberId: user_id });
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
    await logGroupActivity('member_removed', { id: req.params.id }, req.user, req, { memberId: req.params.userId });
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
    await logCompanyActivity('company_created', { id, name }, req.user, req);
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
    await logCompanyActivity('company_updated', { id: req.params.id, name }, req.user, req);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/companies/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Company not found' });
    await logCompanyActivity('company_deleted', { id: req.params.id }, req.user, req);
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
    const allowedTables = ['users', 'categories', 'priorities', 'statuses', 'requests', 'comments', 'activity_log', 'announcements', 'knowledge_base', 'tags', 'templates', 'sla_policies', 'sla_tracking', 'attachments', 'notifications', 'sessions', 'login_audit', 'request_watchers', 'request_tags', 'system_settings', 'feedback', 'groups', 'companies', 'user_groups', 'request_groups', 'password_reset_tokens'];
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
      { key: 'passwordResetTokenTtl', value: '60' },
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
      { key: 'autoEscalationMinutes', value: '120' },
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
    await logSettingsActivity('settings_updated', req.user, req, { changes: Object.keys(updates) });
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
      { key: 'passwordResetTokenTtl', value: '60' },
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
      { key: 'autoEscalationMinutes', value: '120' },
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
    await logSettingsActivity('settings_reset', req.user, req);
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
    await logSettingsActivity('logo_uploaded', req.user, req);
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
    await logSettingsActivity('logo_removed', req.user, req);
    res.json({ message: 'Logo removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================================
// Announcements, Knowledge Base, Tags, Templates, SLA, Watchers, Attachments,
// Notifications, Sessions, and Login Audit CRUD endpoints
// ============================================================================

// --- Announcements ---
app.get('/api/announcements', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const params = [];
    let where = 'WHERE (expires_at IS NULL OR expires_at > NOW())';
    if (!isAdmin) {
      params.push(req.user.role);
      where += ` AND (target_role IS NULL OR target_role = $${params.length})`;
    }
    const result = await pool.query(`SELECT a.*, u.name AS created_by_name FROM announcements a LEFT JOIN users u ON a.created_by = u.id ${where} ORDER BY a.created_at DESC`, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/announcements', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { title, content, priority, target_role, expires_at } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO announcements (id, title, content, priority, target_role, created_by, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, title, content, priority || 'normal', target_role || null, req.user.id, expires_at || null]
    );
    await logActivity({ type: 'announcement_created', message: `Announcement "${title}" created`, userId: req.user.id, entityType: 'announcement', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/announcements/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { title, content, priority, target_role, expires_at } = req.body;
    const result = await pool.query(
      `UPDATE announcements SET title = COALESCE($1, title), content = COALESCE($2, content),
         priority = COALESCE($3, priority), target_role = COALESCE($4, target_role), expires_at = $5
       WHERE id = $6 RETURNING *`,
      [title, content, priority, target_role, expires_at === undefined ? null : expires_at, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
    await logActivity({ type: 'announcement_updated', message: `Announcement updated`, userId: req.user.id, entityType: 'announcement', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/announcements/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Announcement not found' });
    await logActivity({ type: 'announcement_deleted', message: `Announcement deleted`, userId: req.user.id, entityType: 'announcement', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Announcement deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Knowledge Base ---
app.get('/api/knowledge-base', authMiddleware, async (req, res) => {
  try {
    const { search, categoryId } = req.query;
    const params = [];
    let where = "WHERE status = 'published'";
    if (req.user.role === 'admin') where = 'WHERE 1=1';
    if (search) { params.push(`%${search}%`); where += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`; }
    if (categoryId) { params.push(categoryId); where += ` AND category_id = $${params.length}`; }
    const result = await pool.query(
      `SELECT k.*, c.name AS category_name, u.name AS created_by_name
       FROM knowledge_base k
       LEFT JOIN categories c ON k.category_id = c.id
       LEFT JOIN users u ON k.created_by = u.id ${where} ORDER BY k.updated_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/knowledge-base/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT k.*, c.name AS category_name, u.name AS created_by_name
       FROM knowledge_base k
       LEFT JOIN categories c ON k.category_id = c.id
       LEFT JOIN users u ON k.created_by = u.id WHERE k.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    await pool.query('UPDATE knowledge_base SET views = views + 1 WHERE id = $1', [req.params.id]);
    result.rows[0].views = (result.rows[0].views || 0) + 1;
    await logActivity({ type: 'kb_viewed', message: `Knowledge base article viewed`, userId: req.user.id, entityType: 'knowledge_base', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/knowledge-base', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const { title, content, category_id, tags, status } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO knowledge_base (id, title, content, category_id, tags, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [id, title, content, category_id || null, Array.isArray(tags) ? tags : [], status || 'published', req.user.id]
    );
    await logActivity({ type: 'kb_created', message: `Knowledge base article "${title}" created`, userId: req.user.id, entityType: 'knowledge_base', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/knowledge-base/:id', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const { title, content, category_id, tags, status } = req.body;
    const result = await pool.query(
      `UPDATE knowledge_base SET title = COALESCE($1, title), content = COALESCE($2, content),
         category_id = COALESCE($3, category_id), tags = COALESCE($4, tags), status = COALESCE($5, status),
         updated_at = NOW() WHERE id = $6 RETURNING *`,
      [title, content, category_id, Array.isArray(tags) ? tags : null, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Article not found' });
    await logActivity({ type: 'kb_updated', message: `Knowledge base article updated`, userId: req.user.id, entityType: 'knowledge_base', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/knowledge-base/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM knowledge_base WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Article not found' });
    await logActivity({ type: 'kb_deleted', message: `Knowledge base article deleted`, userId: req.user.id, entityType: 'knowledge_base', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Article deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Tags ---
app.get('/api/tags', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tags ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tags', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Tag name is required' });
    const id = uuidv4();
    const result = await pool.query(
      'INSERT INTO tags (id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [id, name.trim(), color || '#6B7280']
    );
    await logActivity({ type: 'tag_created', message: `Tag "${name.trim()}" created`, userId: req.user.id, entityType: 'tag', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Tag name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/tags/:id', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await pool.query(
      'UPDATE tags SET name = COALESCE($1, name), color = COALESCE($2, color) WHERE id = $3 RETURNING *',
      [name, color, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tag not found' });
    await logActivity({ type: 'tag_updated', message: `Tag updated`, userId: req.user.id, entityType: 'tag', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Tag name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tags/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM request_tags WHERE tag_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM tags WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tag not found' });
    await logActivity({ type: 'tag_deleted', message: `Tag deleted`, userId: req.user.id, entityType: 'tag', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Tag deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Templates ---
app.get('/api/templates', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, c.name AS category_name, p.name AS priority_name
       FROM templates t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN priorities p ON t.priority_id = p.id
       WHERE t.is_public = true OR t.created_by = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/templates', authMiddleware, async (req, res) => {
  try {
    const { name, subject, description, category_id, priority_id, is_public } = req.body;
    if (!name || !subject) return res.status(400).json({ error: 'Name and subject are required' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO templates (id, name, subject, description, category_id, priority_id, is_public, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [id, name, subject, description || null, category_id || null, priority_id || null, is_public === undefined ? true : !!is_public, req.user.id]
    );
    await logActivity({ type: 'template_created', message: `Template "${name}" created`, userId: req.user.id, entityType: 'template', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/templates/:id', authMiddleware, async (req, res) => {
  try {
    const tmpl = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    if (tmpl.rows[0].created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });
    const { name, subject, description, category_id, priority_id, is_public } = req.body;
    const result = await pool.query(
      `UPDATE templates SET name = COALESCE($1, name), subject = COALESCE($2, subject),
         description = COALESCE($3, description), category_id = COALESCE($4, category_id),
         priority_id = COALESCE($5, priority_id), is_public = COALESCE($6, is_public),
         updated_at = NOW() WHERE id = $7 RETURNING *`,
      [name, subject, description, category_id, priority_id, is_public === undefined ? null : !!is_public, req.params.id]
    );
    await logActivity({ type: 'template_updated', message: `Template updated`, userId: req.user.id, entityType: 'template', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/templates/:id', authMiddleware, async (req, res) => {
  try {
    const tmpl = await pool.query('SELECT created_by FROM templates WHERE id = $1', [req.params.id]);
    if (tmpl.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    if (tmpl.rows[0].created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Insufficient permissions' });
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    await logActivity({ type: 'template_deleted', message: `Template deleted`, userId: req.user.id, entityType: 'template', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- SLA Policies ---
app.get('/api/sla/policies', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sp.*, c.name AS category_name, p.name AS priority_name
       FROM sla_policies sp
       LEFT JOIN categories c ON sp.category_id = c.id
       LEFT JOIN priorities p ON sp.priority_id = p.id
       ORDER BY sp.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sla/policies', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, category_id, priority_id, response_time_minutes, resolution_time_minutes, escalation_enabled } = req.body;
    if (!name || !response_time_minutes || !resolution_time_minutes) return res.status(400).json({ error: 'Name and response/resolution times are required' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sla_policies (id, name, category_id, priority_id, response_time_minutes, resolution_time_minutes, escalation_enabled, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, name, category_id || null, priority_id || null, response_time_minutes, resolution_time_minutes, escalation_enabled === undefined ? false : !!escalation_enabled]
    );
    await logActivity({ type: 'sla_created', message: `SLA policy "${name}" created`, userId: req.user.id, entityType: 'sla_policy', entityId: id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sla/policies/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { name, category_id, priority_id, response_time_minutes, resolution_time_minutes, escalation_enabled } = req.body;
    const result = await pool.query(
      `UPDATE sla_policies SET name = COALESCE($1, name), category_id = COALESCE($2, category_id),
         priority_id = COALESCE($3, priority_id), response_time_minutes = COALESCE($4, response_time_minutes),
         resolution_time_minutes = COALESCE($5, resolution_time_minutes),
         escalation_enabled = COALESCE($6, escalation_enabled) WHERE id = $7 RETURNING *`,
      [name, category_id, priority_id, response_time_minutes, resolution_time_minutes, escalation_enabled === undefined ? null : !!escalation_enabled, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'SLA policy not found' });
    await logActivity({ type: 'sla_updated', message: `SLA policy updated`, userId: req.user.id, entityType: 'sla_policy', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sla/policies/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sla_policies WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'SLA policy not found' });
    await logActivity({ type: 'sla_deleted', message: `SLA policy deleted`, userId: req.user.id, entityType: 'sla_policy', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'SLA policy deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- SLA Tracking ---
app.get('/api/sla/tracking', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT st.*, r.subject AS request_subject, sp.name AS policy_name
       FROM sla_tracking st
       LEFT JOIN requests r ON st.request_id = r.id
       LEFT JOIN sla_policies sp ON st.sla_policy_id = sp.id
       ORDER BY st.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sla/tracking', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const { request_id, sla_policy_id, response_due_at, resolution_due_at, first_response_at, resolved_at, response_breached, resolution_breached } = req.body;
    if (!request_id) return res.status(400).json({ error: 'request_id is required' });
    const request = await pool.query('SELECT id FROM requests WHERE id = $1', [request_id]);
    if (request.rows.length === 0) return res.status(400).json({ error: 'Request not found' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO sla_tracking (id, request_id, sla_policy_id, response_due_at, resolution_due_at, first_response_at, resolved_at, response_breached, resolution_breached, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       ON CONFLICT (request_id) DO UPDATE SET sla_policy_id = EXCLUDED.sla_policy_id,
         response_due_at = COALESCE(EXCLUDED.response_due_at, sla_tracking.response_due_at),
         resolution_due_at = COALESCE(EXCLUDED.resolution_due_at, sla_tracking.resolution_due_at),
         first_response_at = COALESCE(EXCLUDED.first_response_at, sla_tracking.first_response_at),
         resolved_at = COALESCE(EXCLUDED.resolved_at, sla_tracking.resolved_at),
         response_breached = EXCLUDED.response_breached, resolution_breached = EXCLUDED.resolution_breached,
         updated_at = NOW()
       RETURNING *`,
      [id, request_id, sla_policy_id || null, response_due_at || null, resolution_due_at || null, first_response_at || null, resolved_at || null, response_breached === undefined ? false : !!response_breached, resolution_breached === undefined ? false : !!resolution_breached]
    );
    await logActivity({ type: 'sla_tracking_created', message: `SLA tracking created for request`, userId: req.user.id, entityType: 'sla_tracking', entityId: id, requestId: request_id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sla/tracking/:id', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const { sla_policy_id, response_due_at, resolution_due_at, first_response_at, resolved_at, response_breached, resolution_breached } = req.body;
    const result = await pool.query(
      `UPDATE sla_tracking SET sla_policy_id = COALESCE($1, sla_policy_id),
         response_due_at = COALESCE($2, response_due_at), resolution_due_at = COALESCE($3, resolution_due_at),
         first_response_at = COALESCE($4, first_response_at), resolved_at = COALESCE($5, resolved_at),
         response_breached = COALESCE($6, response_breached), resolution_breached = COALESCE($7, resolution_breached),
         updated_at = NOW() WHERE id = $8 RETURNING *`,
      [sla_policy_id, response_due_at, resolution_due_at, first_response_at, resolved_at, response_breached === undefined ? null : !!response_breached, resolution_breached === undefined ? null : !!resolution_breached, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'SLA tracking record not found' });
    await logActivity({ type: 'sla_tracking_updated', message: `SLA tracking updated`, userId: req.user.id, entityType: 'sla_tracking', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sla/tracking/:id', authMiddleware, roleMiddleware('admin', 'support', 'developer'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sla_tracking WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'SLA tracking record not found' });
    await logActivity({ type: 'sla_tracking_deleted', message: `SLA tracking deleted`, userId: req.user.id, entityType: 'sla_tracking', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'SLA tracking record deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Request Watchers ---
app.get('/api/requests/:id/watchers', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rw.request_id, rw.created_at, u.id AS user_id, u.name, u.role, u.avatar
       FROM request_watchers rw
       JOIN users u ON rw.user_id = u.id
       WHERE rw.request_id = $1`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/requests/:id/watchers', authMiddleware, async (req, res) => {
  try {
    const { user_id } = req.body;
    const userId = user_id || req.user.id;
    const result = await pool.query(
      `INSERT INTO request_watchers (request_id, user_id, created_at) VALUES ($1, $2, NOW())
       ON CONFLICT (request_id, user_id) DO NOTHING RETURNING *`,
      [req.params.id, userId]
    );
    await logActivity({ type: 'watcher_added', message: `Watcher added to request`, userId: req.user.id, entityType: 'watcher', entityId: req.params.id, requestId: req.params.id, req });
    res.status(201).json(result.rows[0] || { request_id: req.params.id, user_id: userId, created_at: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/requests/:id/watchers/:userId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM request_watchers WHERE request_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Watcher not found' });
    await logActivity({ type: 'watcher_removed', message: `Watcher removed from request`, userId: req.user.id, entityType: 'watcher', entityId: req.params.id, requestId: req.params.id, req });
    res.json({ message: 'Watcher removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Attachments ---
app.get('/api/attachments', authMiddleware, roleMiddleware('admin', 'support', 'developer', 'client'), async (req, res) => {
  try {
    const { request_id } = req.query;
    const params = [];
    let where = '';
    if (request_id) { params.push(request_id); where = 'WHERE a.request_id = $1'; }
    const result = await pool.query(
      `SELECT a.*, u.name AS user_name FROM attachments a LEFT JOIN users u ON a.user_id = u.id ${where} ORDER BY a.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/attachments', authMiddleware, async (req, res) => {
  try {
    const { request_id, filename, original_name, mime_type, size_bytes } = req.body;
    if (!request_id || !filename) return res.status(400).json({ error: 'request_id and filename are required' });
    const request = await pool.query('SELECT id FROM requests WHERE id = $1', [request_id]);
    if (request.rows.length === 0) return res.status(400).json({ error: 'Request not found' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO attachments (id, request_id, user_id, filename, original_name, mime_type, size_bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [id, request_id, req.user.id, filename, original_name || filename, mime_type || null, size_bytes || null]
    );
    await logActivity({ type: 'attachment_uploaded', message: `Attachment "${original_name || filename}" uploaded`, userId: req.user.id, entityType: 'attachment', entityId: id, requestId: request_id, req });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/attachments/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM attachments WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Attachment not found' });
    await logActivity({ type: 'attachment_deleted', message: `Attachment deleted`, userId: req.user.id, entityType: 'attachment', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Notifications (persisted, per-user) ---
app.get('/api/notifications', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [req.user.id, limit]
    );
    const unread = await pool.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ notifications: result.rows, unread: unread.rows[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/notifications', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const { user_id, type, title, message, request_id } = req.body;
    if (!user_id || !message) return res.status(400).json({ error: 'user_id and message are required' });
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO notifications (id, user_id, type, title, message, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [id, user_id, type || 'info', title || null, message, request_id || null]
    );
    await logActivity({ type: 'notification_sent', message: `Notification sent: ${title || message}`, userId: req.user.id, entityType: 'notification', entityId: id, requestId: request_id || null, req });
    notifyUser(user_id, message, { type: type || 'info', title, requestId: request_id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    await logActivity({ type: 'notification_read', message: `Notification marked as read`, userId: req.user.id, entityType: 'notification', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true, read_at = NOW() WHERE user_id = $1 AND is_read = false', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/notifications/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found' });
    await logActivity({ type: 'notification_deleted', message: `Notification deleted`, userId: req.user.id, entityType: 'notification', entityId: req.params.id, req });
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Comment Read Tracking (persisted, per-user) ---
app.get('/api/comments/read-status', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT last_read_at FROM comment_read_tracking WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ last_read_at: result.rows[0]?.last_read_at || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/comments/read', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO comment_read_tracking (user_id, last_read_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET last_read_at = NOW()
       RETURNING last_read_at`,
      [req.user.id]
    );
    res.json({ last_read_at: result.rows[0].last_read_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Sessions ---
app.get('/api/sessions', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.name AS user_name, u.email AS user_email
       FROM sessions s LEFT JOIN users u ON s.user_id = u.id
       WHERE s.revoked_at IS NULL ORDER BY s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sessions/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const mine = await pool.query('SELECT id FROM sessions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (mine.rows.length === 0) return res.status(403).json({ error: 'Insufficient permissions' });
    }
    const result = await pool.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
    await logActivity({ type: 'session_revoked', message: `Session revoked`, userId: req.user.id, entityType: 'session', entityId: req.params.id, req });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Login Audit ---
app.get('/api/login-audit', authMiddleware, roleMiddleware('admin', 'support'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { action, email } = req.query;
    const conditions = [];
    const params = [];
    if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
    if (email) { params.push(`%${email}%`); conditions.push(`email ILIKE $${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await pool.query(
      `SELECT l.*, u.name AS user_name FROM login_audit l LEFT JOIN users u ON l.user_id = u.id ${where} ORDER BY l.created_at DESC LIMIT $${params.length + 1}`,
      [...params, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/login-audit/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM login_audit WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Audit record not found' });
    await logActivity({ type: 'audit_deleted', message: `Login audit record deleted`, userId: req.user.id, entityType: 'login_audit', entityId: req.params.id, severity: 'warning', req });
    res.json({ message: 'Audit record deleted' });
  } catch (err) {
    console.error(err);
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

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`RHMS Server running on http://localhost:${PORT}`);
  if (!mailer.isSmtpConfigured()) {
    console.warn('[PasswordResetOTP] WARNING: SMTP is not configured (see server/.env.example). OTP emails will use the in-app fallback until SMTP_HOST/SMTP_USER/SMTP_PASS are set.');
  }
  // First auto-escalation sweep shortly after startup, then every minute.
  setTimeout(() => runAutoEscalation().catch(err => console.error('[AutoEscalation] sweep failed:', err.message)), 15000);
  setInterval(() => runAutoEscalation().catch(err => console.error('[AutoEscalation] sweep failed:', err.message)), 60 * 1000);
});

// ---- Auto Escalation ----
// When enabled, requests assigned to a Developer that are not resolved within
// the configured time are moved to Escalated (same end state as manual
// escalation: status change only, assignment preserved for the Escalation
// Team workflow). DB-driven (assignment timestamp from the activity log, with
// updated_at fallback) so the timer survives refreshes, logins and restarts.
async function runAutoEscalation() {
  const settingsRows = await pool.query(
    "SELECT key, value FROM system_settings WHERE key IN ('escalationEnabled', 'autoEscalationMinutes')"
  );
  const settings = {};
  for (const row of settingsRows.rows) settings[row.key] = row.value;
  if (settings.escalationEnabled !== 'true') return;
  const minutes = parseInt(settings.autoEscalationMinutes, 10);
  if (!Number.isFinite(minutes) || minutes < 1) return;

  const statuses = await pool.query('SELECT id, name FROM statuses');
  const byName = {};
  for (const s of statuses.rows) byName[String(s.name).toLowerCase()] = s.id;
  const escalatedId = byName['escalated'];
  if (!escalatedId) return;
  const terminalIds = ['resolved', 'closed', 'rejected', 'escalated']
    .map(n => byName[n])
    .filter(Boolean);

  const candidates = await pool.query(
    `SELECT r.id, r.status_id, r.assigned_to, r.assigned_group, r.client_id, r.updated_at,
            s.name AS status_name, u.name AS assignee_name, g.name AS group_name
     FROM requests r
     LEFT JOIN users u ON u.id = r.assigned_to
     LEFT JOIN groups g ON g.id = r.assigned_group
     JOIN statuses s ON s.id = r.status_id
     WHERE r.status_id <> ALL($1)
       AND ((r.assigned_to IS NOT NULL AND u.role = 'developer')
         OR (r.assigned_to IS NULL AND r.assigned_group IS NOT NULL))`,
    [terminalIds.length > 0 ? terminalIds : ['__none__']]
  );
  if (candidates.rows.length === 0) return;
  const now = Date.now();

  for (const req of candidates.rows) {
    try {
      // Individual assignment: exact DB timestamp of the latest assignment.
      // Group assignment: exact DB timestamp of the latest group assignment.
      const isGroup = !req.assigned_to && !!req.assigned_group;
      const assignedRows = await pool.query(
        `SELECT created_at FROM activity_log WHERE request_id = $1 AND type = $2
         ORDER BY created_at DESC LIMIT 1`,
        [req.id, isGroup ? 'assigned_group_changed' : 'assigned']
      );
      const assignedAt = assignedRows.rows.length > 0
        ? new Date(assignedRows.rows[0].created_at).getTime()
        : new Date(req.updated_at).getTime();
      if (!Number.isFinite(assignedAt) || now - assignedAt < minutes * 60 * 1000) continue;

      // Re-check status inside the loop so a concurrent resolve wins.
      const fresh = await pool.query('SELECT status_id, assigned_to, assigned_group FROM requests WHERE id = $1', [req.id]);
      if (fresh.rows.length === 0 || fresh.rows[0].status_id !== req.status_id) continue;
      if (terminalIds.includes(fresh.rows[0].status_id)) continue;
      // Skip if the assignment changed since the candidate was selected.
      if ((fresh.rows[0].assigned_to || null) !== (req.assigned_to || null)) continue;
      if ((fresh.rows[0].assigned_group || null) !== (req.assigned_group || null)) continue;

      const timestamp = new Date().toISOString();
      await pool.query('UPDATE requests SET status_id = $1, updated_at = $2 WHERE id = $3', [escalatedId, timestamp, req.id]);
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'status_update', req.id, null, `Changed status from ${req.status_name} to Escalated`, timestamp]
      );
      const reason = isGroup
        ? `This request was automatically escalated because the assigned group (${req.group_name || 'group'}) did not complete it within the configured time (${minutes} minutes).`
        : `This request was automatically escalated because the Developer did not complete it within the configured time (${minutes} minutes).`;
      await pool.query(
        'INSERT INTO activity_log (id, type, request_id, user_id, message, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [uuidv4(), 'escalated', req.id, null, reason, timestamp]
      );
      const adminMsg = isGroup
        ? `Request #${req.id} was automatically escalated (group ${req.group_name || 'assignment'} exceeded ${minutes} minutes)`
        : `Request #${req.id} was automatically escalated (${req.assignee_name || 'developer'} exceeded ${minutes} minutes)`;
      notifyAdmins(adminMsg, { type: 'status_change', requestId: req.id, status: 'Escalated' });
      if (req.assigned_to) {
        notifyUser(req.assigned_to, `Request #${req.id} was automatically escalated because it was not completed within ${minutes} minutes`, { type: 'status_change', requestId: req.id, status: 'Escalated' });
      }
      if (isGroup && req.assigned_group) {
        // Notify the developers of the assigned group (existing group system).
        const members = await pool.query(
          `SELECT u.id FROM users u JOIN user_groups ug ON ug.user_id = u.id
           WHERE ug.group_id = $1 AND u.role = 'developer'`,
          [req.assigned_group]
        );
        for (const m of members.rows) {
          notifyUser(m.id, `Request #${req.id} assigned to your group was automatically escalated after ${minutes} minutes`, { type: 'status_change', requestId: req.id, status: 'Escalated' });
        }
      }
      if (req.client_id) {
        notifyUser(req.client_id, `Your request #${req.id} status changed to Escalated`, { type: 'status_change', requestId: req.id, status: 'Escalated' });
      }
      console.log(`[AutoEscalation] Request #${req.id} escalated after ${minutes} minutes (${isGroup ? 'group' : 'developer'} assignment).`);
    } catch (err) {
      console.error(`[AutoEscalation] Failed for request #${req.id}:`, err.message);
    }
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the process using it, or set PORT to a free port.`);
    process.exit(1);
  }
  throw err;
});
