import React, { useState, useRef, useCallback } from 'react';
import { getStatusIcon } from '../utils/statusIcons';
import { shareOfTotalPercent } from '../utils/statusShare';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { usePageBack } from '../utils/sidebarNav';
import RequestsTable from './RequestsTable';
import RequestCalendar from './RequestCalendar';
import Icon from './Icon';

export default function DeveloperDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const shareLabel = t('common.ofTotal');
  const goBack = usePageBack('/');
  const tableRef = useRef();
  const [shared, setShared] = useState({ requests: [], statuses: [], showMyTasks: false, filter: { status: '' } });
  const handleDataChange = useCallback((data) => setShared(data), []);

  const countInScope = (list) => (
    shared.showMyTasks
      ? list.filter(r => r.assignedTo === user.id && r.status?.name !== 'New')
      : list
  );

  const displayRequests = countInScope(shared.requests);

  const countByStatusId = (list, id) => list.filter(r => r.status?.id === id).length;

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

  const DevStatCard = ({ icon, value, label, color, onClick, share, shareLabel }) => {
    const shareNum = parseFloat(share) || 0;
    return (
      <div className={`stat-card${onClick ? ' stat-card-interactive' : ''}`}
        style={{
          cursor: 'pointer',
          '--stat-accent': color,
          '--stat-shadow': `${color}30`
        }}
        onClick={onClick}
      >
        <div className="stat-icon" style={{ background: color + '15', color }}>{icon}</div>
        <div className="stat-content">
          <h3>{value}</h3>
          <p>{label}</p>
          <span className="stat-change up">
            {'↑'} {shareNum}% {shareLabel}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
<div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('dashboard.developerWorkspace')}</h1>
          <p>{t('dashboard.developerWelcome', { name: user?.name?.split(' ')[0] })}</p>
          <h3 style={{ marginTop: '8px', marginBottom: 0 }}>{t('common.allRequests')}</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <RequestCalendar />
        </div>
      </div>

      <div className="stats-grid">
        {(shared.statuses || []).filter(s => s.is_active !== false && s.name.toLowerCase() !== 'reopened').map(s => (
          <DevStatCard
            key={s.id}
            icon={<Icon name={getStatusIcon(s.name)} />}
            value={countByStatusId(displayRequests, s.id)}
            label={s.name}
            color={s.color || '#6B7280'}
            onClick={() => toggleStatusFilter(s.name)}
            share={shareOfTotalPercent(countByStatusId(displayRequests, s.id), displayRequests.length)}
            shareLabel={shareLabel}
          />
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        <RequestsTable ref={tableRef} user={user} title={t('common.allRequests')} onDataChange={handleDataChange} />
      </div>
    </div>
  );
}

