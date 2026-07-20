DROP DATABASE IF EXISTS rhms;
CREATE DATABASE rhms;

\c rhms;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE groups (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#6B7280'
);

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'client',
  group_id VARCHAR(50),
  avatar VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
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

CREATE TABLE requests (
  id VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  client_id VARCHAR(50) REFERENCES users(id),
  category_id VARCHAR(50) REFERENCES categories(id),
  priority_id VARCHAR(50) REFERENCES priorities(id),
  status_id VARCHAR(50) REFERENCES statuses(id),
  assigned_to VARCHAR(50) REFERENCES users(id),
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE comments (
  id VARCHAR(50) PRIMARY KEY,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_log (
  id VARCHAR(50) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  request_id VARCHAR(50),
  user_id VARCHAR(50) REFERENCES users(id),
  message TEXT NOT NULL,
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

CREATE TABLE tags (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20) DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE request_tags (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  tag_id VARCHAR(50) REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, tag_id)
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

CREATE INDEX idx_requests_client_id ON requests(client_id);
CREATE INDEX idx_requests_category_id ON requests(category_id);
CREATE INDEX idx_requests_priority_id ON requests(priority_id);
CREATE INDEX idx_requests_status_id ON requests(status_id);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_comments_request_id ON comments(request_id);
CREATE INDEX idx_activity_log_request_id ON activity_log(request_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category_id);
CREATE INDEX idx_attachments_request ON attachments(request_id);
CREATE INDEX idx_sla_category_priority ON sla_policies(category_id, priority_id);
CREATE INDEX idx_announcements_priority ON announcements(priority);
