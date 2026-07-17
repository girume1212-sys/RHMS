CREATE TABLE IF NOT EXISTS user_groups (
  user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
  group_id VARCHAR(50) REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

INSERT INTO user_groups (user_id, group_id)
SELECT id, group_id FROM users WHERE group_id IS NOT NULL
ON CONFLICT DO NOTHING;
