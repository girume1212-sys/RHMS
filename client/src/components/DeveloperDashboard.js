import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import RequestsTable from './RequestsTable';
import RequestCalendar from './RequestCalendar';

export default function DeveloperDashboard() {
  const { user } = useAuth();
  const tableRef = useRef();
  const [shared, setShared] = useState({ requests: [], statuses: [], showMyTasks: false, filter: { status: '' } });

  const handleDataChange = useCallback((data) => setShared(data), []);

  const displayRequests = shared.showMyTasks
    ? shared.requests.filter(r => r.assignedTo === user.id && r.status?.name !== 'New')
    : shared.requests;

  const stats = {
    total: displayRequests.length,
    newCount: displayRequests.filter(r => r.status?.name === 'New').length,
    inProgress: displayRequests.filter(r => r.status?.name === 'In Progress').length,
    waiting: displayRequests.filter(r => r.status?.name === 'Waiting for Client').length,
    resolved: displayRequests.filter(r => r.status?.name === 'Resolved').length,
    assigned: displayRequests.filter(r => r.status?.name === 'Assigned').length,
    escalated: displayRequests.filter(r => r.status?.name === 'Escalated').length,
    closed: displayRequests.filter(r => r.status?.name === 'Closed').length,
    rejected: displayRequests.filter(r => r.status?.name === 'Rejected').length,
  };

  const toggleStatusFilter = (name) => {
    tableRef.current?.setStatusFilter(shared.filter.status === name ? '' : name);
  };

  const DevStatCard = ({ icon, value, label, color, onClick }) => {
    const [h, setH] = useState(false);
    return (
      <div className="stat-card"
        style={{
          cursor: 'pointer',
          transform: h ? 'translateY(-4px)' : '',
          boxShadow: h ? `0 8px 25px ${color}30` : '',
          borderLeft: h ? `4px solid ${color}` : '4px solid transparent',
          transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s'
        }}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
        onClick={onClick}
      >
        <div className="stat-icon" style={{ background: color + '15', color }}>{icon}</div>
        <div className="stat-content">
          <h3>{value}</h3>
          <p>{label}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Developer Workspace</h1>
          <p>Welcome back, {user?.name?.split(' ')[0]}! View and manage all group requests.</p>
          <h3 style={{ marginTop: '8px', marginBottom: 0 }}>All Requests</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <RequestCalendar />
        </div>
      </div>

      <div className="stats-grid">
        <DevStatCard icon="📥" value={stats.newCount} label="New" color="#3B82F6" onClick={() => toggleStatusFilter('New')} />
        <DevStatCard icon="📋" value={stats.assigned} label="Newly Assigned" color="#8B5CF6" onClick={() => toggleStatusFilter('Assigned')} />
        <DevStatCard icon="⚡" value={stats.inProgress} label="In Progress" color="#F59E0B" onClick={() => toggleStatusFilter('In Progress')} />
        <DevStatCard icon="⏰" value={stats.waiting} label="Awaiting Client" color="#F97316" onClick={() => toggleStatusFilter('Waiting for Client')} />
        <DevStatCard icon="🚨" value={stats.escalated} label="Escalated" color="#EF4444" onClick={() => toggleStatusFilter('Escalated')} />
        <DevStatCard icon="✅" value={stats.resolved} label="Resolved" color="#10B981" onClick={() => toggleStatusFilter('Resolved')} />
        <DevStatCard icon="🔒" value={stats.closed} label="Closed" color="#6B7280" onClick={() => toggleStatusFilter('Closed')} />
        <DevStatCard icon="❌" value={stats.rejected} label="Rejected" color="#DC2626" onClick={() => toggleStatusFilter('Rejected')} />
      </div>

      <div style={{ marginTop: '24px' }}>
        <RequestsTable ref={tableRef} user={user} title="All Requests" onDataChange={handleDataChange} />
      </div>
    </div>
  );
}
