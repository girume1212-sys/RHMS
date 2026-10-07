-- ============================================================================
-- RHMS Activity Log Enhancement Migration
-- Adds comprehensive tracking columns to activity_log table
-- ============================================================================

ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS entity_id VARCHAR(50);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';

CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_severity ON activity_log(severity);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type_created ON activity_log(type, created_at DESC);
