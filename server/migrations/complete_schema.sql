-- ============================================================================
-- RHMS Schema Completion Migration
-- Adds the missing tables, columns, indexes, foreign keys and constraints that
-- make the Support Request & Issue Tracking System complete, scalable and
-- production-ready. Idempotent - safe to run multiple times.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1) MISSING COLUMNS (from prior migrations that were partially applied)
-- ---------------------------------------------------------------------------

-- Group leaders: supports the group-assignment workflow (group_leader flag).
ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS group_leader BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2) MISSING INDEXES ON EXISTING TABLES
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_requests_assigned_group ON requests(assigned_group);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_updated_at ON requests(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_client_created ON requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_sla_category_priority ON sla_policies(category_id, priority_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_status ON knowledge_base(status);
CREATE INDEX IF NOT EXISTS idx_attachments_request ON attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_target_role ON announcements(target_role);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_templates_category_id ON templates(category_id);
CREATE INDEX IF NOT EXISTS idx_templates_priority_id ON templates(priority_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON user_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_request_tags_tag_id ON request_tags(tag_id);

-- ---------------------------------------------------------------------------
-- 3) NEW TABLES
-- ---------------------------------------------------------------------------

-- Per-user persisted notifications (bell icon, unread badge, mark-all-read).
CREATE TABLE IF NOT EXISTS notifications (
  id         VARCHAR(50) PRIMARY KEY,
  user_id    VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL DEFAULT 'info',
  title      VARCHAR(500),
  message    TEXT NOT NULL,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  read_at    TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_request_id ON notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Auth sessions: supports remember-me, refresh tokens, logout-all, revocation.
CREATE TABLE IF NOT EXISTS sessions (
  id                 VARCHAR(50) PRIMARY KEY,
  user_id            VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash         VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255) UNIQUE,
  user_agent         TEXT,
  ip_address         VARCHAR(45),
  expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at         TIMESTAMP WITH TIME ZONE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Security audit trail for authentication and privileged actions.
CREATE TABLE IF NOT EXISTS login_audit (
  id         VARCHAR(50) PRIMARY KEY,
  user_id    VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
  email      VARCHAR(255),
  action     VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details    TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_email ON login_audit(email);
CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_audit_action ON login_audit(action);

-- Per-request SLA state, complementing the sla_policies table.
CREATE TABLE IF NOT EXISTS sla_tracking (
  id                  VARCHAR(50) PRIMARY KEY,
  request_id          VARCHAR(50) NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  sla_policy_id       VARCHAR(50) REFERENCES sla_policies(id) ON DELETE SET NULL,
  response_due_at     TIMESTAMP WITH TIME ZONE,
  resolution_due_at   TIMESTAMP WITH TIME ZONE,
  first_response_at   TIMESTAMP WITH TIME ZONE,
  resolved_at         TIMESTAMP WITH TIME ZONE,
  response_breached   BOOLEAN NOT NULL DEFAULT false,
  resolution_breached BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_tracking_policy ON sla_tracking(sla_policy_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_due ON sla_tracking(response_due_at, resolution_due_at);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breached ON sla_tracking(response_breached, resolution_breached);

-- Request watchers / followers: users subscribed to updates on a request.
CREATE TABLE IF NOT EXISTS request_watchers (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id    VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_request_watchers_user ON request_watchers(user_id);

-- ---------------------------------------------------------------------------
-- 4) REQUEST ACTIVITY INTEGRITY
--    activity_log.request_id is nullable today; backfill-safe FK with
--    ON DELETE SET NULL keeps history while requests are removed.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_log_request_id_fkey'
  ) THEN
    ALTER TABLE activity_log
      ADD CONSTRAINT activity_log_request_id_fkey
      FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL;
  END IF;
END $$;
