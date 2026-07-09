import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);

  useEffect(() => { api.get('/api/activity').then(setActivities); }, []);

  const getActivityIcon = (type) => {
    const icons = { status_update: '🔄', comment: '💬', resolved: '✅', created: '➕', closed: '🔒', assigned: '👤' };
    return icons[type] || '📋';
  };

  const getActivityColor = (type) => {
    const colors = { status_update: '#F59E0B', comment: '#3B82F6', resolved: '#10B981', created: '#8B5CF6', closed: '#6B7280', assigned: '#EC4899' };
    return colors[type] || '#6B7280';
  };

  return (
    <div className="page-container">
      <div className="page-header"><div><h1>Activity Log</h1><p>Track all system activities and changes</p></div></div>
      <div className="activity-timeline">
        {activities.map(a => (
          <div key={a.id} className="timeline-item">
            <div className="timeline-icon" style={{ background: getActivityColor(a.type) + '20', color: getActivityColor(a.type) }}>
              {getActivityIcon(a.type)}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <span className="timeline-action">{a.message}</span>
                <span className="timeline-request">#{a.requestId}</span>
              </div>
              <div className="timeline-meta">
                by <strong>{a.user?.name || 'Unknown'}</strong> · {new Date(a.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
