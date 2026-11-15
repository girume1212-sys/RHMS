-- Many-to-many mapping between companies and support groups.
CREATE TABLE IF NOT EXISTS company_groups (
  company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  group_id VARCHAR(50) NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (company_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_company_groups_company ON company_groups(company_id);
CREATE INDEX IF NOT EXISTS idx_company_groups_group ON company_groups(group_id);

-- Preserve existing single-company assignments made through groups.company_id.
INSERT INTO company_groups (company_id, group_id)
SELECT g.company_id, g.id
FROM groups g
WHERE g.company_id IS NOT NULL AND g.company_id <> ''
ON CONFLICT DO NOTHING;

-- Delivery log and deduplication for workflow emails.
CREATE TABLE IF NOT EXISTS email_notifications (
  id VARCHAR(50) PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  recipient_id VARCHAR(50),
  recipient_email VARCHAR(255) NOT NULL DEFAULT '',
  group_id VARCHAR(50),
  dedup_key VARCHAR(255) UNIQUE,
  subject VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  message_id VARCHAR(255),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_request ON email_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_recipient ON email_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
