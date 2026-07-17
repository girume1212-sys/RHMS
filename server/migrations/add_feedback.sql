-- Migration: Add feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(50) PRIMARY KEY,
  request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
  user_id VARCHAR(50) REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_request_id ON feedback(request_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- Add some sample feedback for resolved requests
INSERT INTO feedback (id, request_id, user_id, rating, comment, created_at) VALUES
  ('FB-001', 'REQ-2024-00122', '5', 5, 'Great work! The payroll issue was resolved quickly.', '2024-05-18T10:00:00.000Z'),
  ('FB-002', 'REQ-2024-00116', '5', 4, 'The duplicate attendance entries are fixed. Thank you!', '2024-05-13T14:00:00.000Z'),
  ('FB-003', 'REQ-2024-00119', '8', 5, 'Profile saving works perfectly now.', '2024-05-17T09:00:00.000Z'),
  ('FB-004', 'REQ-2024-00114', '7', 3, 'Fixed but took some time. Mobile login works now.', '2024-05-11T11:00:00.000Z'),
  ('FB-005', 'REQ-2024-00123', '10', 5, 'Import feature works great now. Very helpful!', '2024-05-19T10:00:00.000Z')
ON CONFLICT DO NOTHING;
