-- Create request_groups junction table for group-based visibility
CREATE TABLE IF NOT EXISTS request_groups (
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_request_groups_request_id ON request_groups(request_id);
CREATE INDEX IF NOT EXISTS idx_request_groups_group_id ON request_groups(group_id);

-- Backfill: populate request_groups for existing requests based on client's group memberships
INSERT INTO request_groups (request_id, group_id)
SELECT r.id, ug.group_id
FROM requests r
JOIN user_groups ug ON r.client_id = ug.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM request_groups rg WHERE rg.request_id = r.id
)
ON CONFLICT DO NOTHING;
