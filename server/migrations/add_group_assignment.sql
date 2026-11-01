
ALTER TABLE requests ADD COLUMN IF NOT EXISTS assigned_group VARCHAR(50) REFERENCES groups(id) ON DELETE SET NULL;


ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS group_leader BOOLEAN DEFAULT false;


CREATE INDEX IF NOT EXISTS idx_requests_assigned_group ON requests(assigned_group);
