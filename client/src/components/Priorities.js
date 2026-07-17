import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Priorities() {
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/priorities').then(data => { setPriorities(data); setLoading(false); })
      .catch(err => { setError('Failed to load priorities: ' + err.message); setLoading(false); });
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Priorities</h1>
          <p>Manage request priority levels</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="grid-cards">
          {priorities.map(p => (
            <div key={p.id} className="priority-card">
              <div className="priority-color" style={{ background: p.color }}></div>
              <h3>{p.name}</h3>
              <p>Level: {p.level}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
