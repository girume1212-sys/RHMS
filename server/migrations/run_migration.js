const pool = require('../db');

async function migrate() {
  try {
    // Create feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id VARCHAR(50) PRIMARY KEY,
        request_id VARCHAR(50) REFERENCES requests(id) ON DELETE CASCADE,
        user_id VARCHAR(50) REFERENCES users(id),
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(request_id, user_id)
      )
    `);
    console.log('Feedback table created');

    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_request_id ON feedback(request_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)');
    console.log('Indexes created');

    // Get resolved requests and their clients
    const resolved = await pool.query("SELECT id, client_id FROM requests WHERE status_id IN ('5','6')");
    const feedbackData = [
      { requestId: resolved.rows[0]?.id, userId: resolved.rows[0]?.client_id, rating: 5, comment: 'Great work! The issue was resolved quickly.' },
      { requestId: resolved.rows[1]?.id, userId: resolved.rows[1]?.client_id, rating: 4, comment: 'Fixed but took some time.' },
      { requestId: resolved.rows[2]?.id, userId: resolved.rows[2]?.client_id, rating: 5, comment: 'Works perfectly now. Very helpful!' },
    ].filter(f => f.requestId && f.userId);

    for (let i = 0; i < feedbackData.length; i++) {
      const f = feedbackData[i];
      await pool.query(
        'INSERT INTO feedback (id, request_id, user_id, rating, comment) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [`FB-${String(i+1).padStart(3,'0')}`, f.requestId, f.userId, f.rating, f.comment]
      );
    }
    console.log('Sample feedback inserted');
    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    pool.end();
  }
}

migrate();
