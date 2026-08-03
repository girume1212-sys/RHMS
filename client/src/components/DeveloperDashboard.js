import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import RequestsTable from './RequestsTable';
import RequestCalendar from './RequestCalendar';
import Icon from './Icon';

export default function DeveloperDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
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
          <h1>{t('dashboard.developerWorkspace')}</h1>
          <p>{t('dashboard.developerWelcome', { name: user?.name?.split(' ')[0] })}</p>
          <h3 style={{ marginTop: '8px', marginBottom: 0 }}>{t('common.allRequests')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <RequestCalendar />
        </div>
      </div>

      <div className="stats-grid">
        <DevStatCard icon={<Icon name="new" />} value={stats.newCount} label={t('common.new')} color="#3B82F6" onClick={() => toggleStatusFilter('New')} />
        <DevStatCard icon={<Icon name="assigned" />} value={stats.assigned} label={t('common.newlyAssigned')} color="#8B5CF6" onClick={() => toggleStatusFilter('Assigned')} />
        <DevStatCard icon={<Icon name="inProgress" />} value={stats.inProgress} label={t('common.inProgress')} color="#F59E0B" onClick={() => toggleStatusFilter('In Progress')} />
        <DevStatCard icon={<Icon name="waiting" />} value={stats.waiting} label={t('common.awaitingClient')} color="#F97316" onClick={() => toggleStatusFilter('Waiting for Client')} />
        <DevStatCard icon={<Icon name="escalated" />} value={stats.escalated} label={t('common.escalated')} color="#EF4444" onClick={() => toggleStatusFilter('Escalated')} />
        <DevStatCard icon={<Icon name="resolved" />} value={stats.resolved} label={t('common.resolved')} color="#10B981" onClick={() => toggleStatusFilter('Resolved')} />
        <DevStatCard icon={<Icon name="closed" />} value={stats.closed} label={t('common.closed')} color="#6B7280" onClick={() => toggleStatusFilter('Closed')} />
        <DevStatCard icon={<Icon name="rejected" />} value={stats.rejected} label={t('common.rejected')} color="#DC2626" onClick={() => toggleStatusFilter('Rejected')} />
      </div>

      <div style={{ marginTop: '24px' }}>
        <RequestsTable ref={tableRef} user={user} title={t('common.allRequests')} onDataChange={handleDataChange} />
      </div>
    </div>
  );
}

