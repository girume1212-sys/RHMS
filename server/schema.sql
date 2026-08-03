DROP DATABASE IF EXISTS rhms;
CREATE DATABASE rhms;

\c rhms;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- COMPLETE RHMS SCHEMA BASELINE
-- Mirrors the production database (tables, columns, constraints, indexes).
-- IDs are server-generated VARCHAR(50); timestamps are timezone-aware.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Core reference tables (no dependencies)
-- ----------------------------------------------------------------------------

CREATE TABLE companies (
  id VARCHAR(50) PRIMARY KEY,
  company_id VARCHAR(100) UNIQUE,
  name VARCHAR(255) NOT NULL,
  industry VARCHAR(100),
  company_type VARCHAR(50),
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6B7280'
);

CREATE TABLE priorities (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280',
  level INTEGER DEFAULT 1
);

CREATE TABLE statuses (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#6B7280'
);

CREATE TABLE tags (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Groups and users
-- ----------------------------------------------------------------------------

CREATE TABLE groups (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6B7280',
  company_id VARCHAR(50) REFERENCES companies(id) ON DELETE SET NULL
);

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'client',
  avatar VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  group_id VARCHAR(50),
  company_name VARCHAR(255) DEFAULT '',
  approved BOOLEAN DEFAULT false,
  login_attempts INTEGER DEFAULT 0,
  language VARCHAR(10) DEFAULT 'en'
);

CREATE TABLE user_groups (
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
  group_leader BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE sessions (
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
);

CREATE TABLE login_audit (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  action VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Requests and ticket workflow
-- ----------------------------------------------------------------------------

CREATE TABLE requests (
  id VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  client_id VARCHAR(50) REFERENCES users(id),
  category_id VARCHAR(50) REFERENCES categories(id),
  priority_id VARCHAR(50) REFERENCES priorities(id),
  status_id VARCHAR(50) REFERENCES statuses(id),
  assigned_to VARCHAR(50) REFERENCES users(id),
  assigned_group VARCHAR(50) REFERENCES groups(id) ON DELETE SET NULL,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE comments (
  id VARCHAR(50) PRIMARY KEY,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  content TEXT NOT NULL,
  attachments TEXT DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_log (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE SET NULL,
  user_id VARCHAR(50) REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE attachments (
  id VARCHAR(50) PRIMARY KEY,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE request_groups (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, group_id)
);

CREATE TABLE request_tags (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  tag_id VARCHAR(50) REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, tag_id)
);

CREATE TABLE request_watchers (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE notifications (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(500),
  message TEXT NOT NULL,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE feedback (
  id VARCHAR(50) PRIMARY KEY,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Knowledge base, announcements, templates, SLA
-- ----------------------------------------------------------------------------

CREATE TABLE knowledge_base (
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
);

CREATE TABLE announcements (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  target_role VARCHAR(20),
  created_by VARCHAR(50) REFERENCES users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE templates (
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
);

CREATE TABLE sla_policies (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category_id VARCHAR(50) REFERENCES categories(id) ON DELETE CASCADE,
  priority_id VARCHAR(50) REFERENCES priorities(id) ON DELETE CASCADE,
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,
  escalation_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sla_tracking (
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
);

-- ----------------------------------------------------------------------------
-- System settings
-- ----------------------------------------------------------------------------

CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_login_audit_user ON login_audit(user_id);
CREATE INDEX idx_login_audit_email ON login_audit(email);
CREATE INDEX idx_login_audit_created ON login_audit(created_at DESC);
CREATE INDEX idx_login_audit_action ON login_audit(action);

CREATE INDEX idx_requests_client_id ON requests(client_id);
CREATE INDEX idx_requests_category_id ON requests(category_id);
CREATE INDEX idx_requests_priority_id ON requests(priority_id);
CREATE INDEX idx_requests_status_id ON requests(status_id);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_requests_assigned_group ON requests(assigned_group);
CREATE INDEX idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX idx_requests_updated_at ON requests(updated_at DESC);
CREATE INDEX idx_requests_client_created ON requests(client_id, created_at DESC);

CREATE INDEX idx_comments_request_id ON comments(request_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_activity_log_request_id ON activity_log(request_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_attachments_request ON attachments(request_id);
CREATE INDEX idx_feedback_request_id ON feedback(request_id);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_request_id ON notifications(request_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_request_watchers_user ON request_watchers(user_id);
CREATE INDEX idx_request_groups_request_id ON request_groups(request_id);
CREATE INDEX idx_request_groups_group_id ON request_groups(group_id);
CREATE INDEX idx_request_tags_tag_id ON request_tags(tag_id);

CREATE INDEX idx_knowledge_base_category ON knowledge_base(category_id);
CREATE INDEX idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX idx_announcements_priority ON announcements(priority);
CREATE INDEX idx_announcements_target_role ON announcements(target_role);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX idx_templates_category_id ON templates(category_id);
CREATE INDEX idx_templates_priority_id ON templates(priority_id);
CREATE INDEX idx_sla_category_priority ON sla_policies(category_id, priority_id);
CREATE INDEX idx_sla_tracking_policy ON sla_tracking(sla_policy_id);
CREATE INDEX idx_sla_tracking_due ON sla_tracking(response_due_at, resolution_due_at);
CREATE INDEX idx_sla_tracking_breached ON sla_tracking(response_breached, resolution_breached);
