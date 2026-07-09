CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE requests (
  id VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  client_id VARCHAR(50) REFERENCES users(id),
  category_id VARCHAR(50) REFERENCES categories(id),
  priority_id VARCHAR(50) REFERENCES priorities(id),
  status_id VARCHAR(50) REFERENCES statuses(id),
  assigned_to VARCHAR(50) REFERENCES users(id),
  attachments JSONB DEFAULT '[]'::jsonb,
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

CREATE INDEX idx_requests_client_id ON requests(client_id);
CREATE INDEX idx_requests_category_id ON requests(category_id);
CREATE INDEX idx_requests_priority_id ON requests(priority_id);
CREATE INDEX idx_requests_status_id ON requests(status_id);
CREATE INDEX idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX idx_comments_request_id ON comments(request_id);
CREATE INDEX idx_activity_log_request_id ON activity_log(request_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
