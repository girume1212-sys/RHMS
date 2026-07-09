import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Priorities() {
  const [priorities, setPriorities] = useState([]);

  useEffect(() => { api.get('/api/priorities').then(setPriorities); }, []);

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Priorities</h1><p>Manage request priority levels</p></div></div>
      <div className="grid-cards">
        {priorities.map(p => (
          <div key={p.id} className="priority-card">
            <div className="priority-color" style={{ background: p.color }}></div>
            <h3>{p.name}</h3>
            <p>Level: {p.level}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
