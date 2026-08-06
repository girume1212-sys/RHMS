import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { translateActivityMessage } from '../i18n/translateServer';
import Icon from './Icon';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';

export default function ActivityLog() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/activity'));
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/activity').then(data => { setActivities(data); setLoading(false); })
      .catch(err => { setError(t('common.failedToLoadActivity') + ' ' + err.message); setLoading(false); });
  }, []);

  const getActivityIcon = (type) => {
    const icons = { status_update: 'refresh', comment: 'comment', resolved: 'resolved', created: 'plus', closed: 'lock', assigned: 'user' };
    return icons[type] || 'clipboard';
  };

  const getActivityColor = (type) => {
    const colors = { status_update: '#F59E0B', comment: '#3B82F6', resolved: '#10B981', created: '#8B5CF6', closed: '#6B7280', assigned: '#EC4899' };
    return colors[type] || '#6B7280';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('common.activityLog')}</h1>
          <p>{t('common.activityLogSubtitle')}</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="activity-timeline">
          {activities.filter(a => a.user?.id !== user?.id).length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}><Icon name="clipboard" size={48} /></div>
              <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>{t('common.noActivityYet')}</h3>
              <p style={{ margin: 0, fontSize: '14px' }}>{t('common.activityEmptyDesc')}</p>
            </div>
          ) : (
            activities.filter(a => a.user?.id !== user?.id).map(a => (
              <div key={a.id} className="timeline-item">
                <div className="timeline-icon" style={{ background: getActivityColor(a.type) + '20', color: getActivityColor(a.type) }}>
                  <Icon name={getActivityIcon(a.type)} size={18} />
                </div>
                <div className="timeline-content">
                  <div className="timeline-header">
                    <span className="timeline-action">{translateActivityMessage(a.message, a.type, t)}</span>
                    <span className="timeline-request">#{a.requestId}</span>
                  </div>
                  <div className="timeline-meta">
                    {t('common.by')} <strong>{a.user?.name || t('common.unknown')}</strong> · {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
