ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE statuses ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

UPDATE statuses SET is_system = TRUE WHERE id IN ('1', '2', '3', '4', '5', '6', '7', '8', '9');
UPDATE statuses SET sort_order = CAST(id AS INTEGER) WHERE sort_order = 0;
