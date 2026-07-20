-- Add assigned_group column to requests table
ALTER TABLE requests ADD COLUMN IF NOT EXISTS assigned_group VARCHAR(50) REFERENCES groups(id) ON DELETE SET NULL;

-- Add group_leader column to user_groups junction table
ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS group_leader BOOLEAN DEFAULT false;

-- Create index for group assignment lookups
CREATE INDEX IF NOT EXISTS idx_requests_assigned_group ON requests(assigned_group);
