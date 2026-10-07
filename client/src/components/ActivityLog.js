import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { translateActivityMessage } from '../i18n/translateServer';
import Icon from './Icon';
import PageNumbers from './PageNumbers';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';

export default function ActivityLog() {
  const { user } = useAuth();
  const goBack = useBackNavigation(user?.role === 'client' ? '/client/requests' : getMenuAbove('/activity'));
  const { t } = useTranslation();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  useEffect(() => {
    api.get('/api/activity?limit=100').then(data => {
      setActivities(Array.isArray(data) ? data : (data.activities || []));
      setLoading(false);
    })
      .catch(err => { setError(t('common.failedToLoadActivity') + ' ' + err.message); setLoading(false); });
  }, [t]);

  const totalPages = Math.max(1, Math.ceil(activities.length / perPage));
  // Keep current page valid when page size / filters change.
  useEffect(() => {
    if (typeof totalPages === 'number' && totalPages > 0 && page > totalPages) setPage(totalPages);
    else if (typeof totalPages === 'number' && totalPages === 0 && page !== 1) setPage(1);
  }, [totalPages, page]);

  const paginatedActivities = activities.slice((page - 1) * perPage, page * perPage);

  const getActivityIcon = (type) => {
    const icons = {
      login_success: 'login', login_failed: 'login', login_locked: 'lock', logout: 'logout',
      signup: 'user', google_login: 'login', google_signup: 'user',
      password_reset_requested: 'lock', password_reset_completed: 'lock', password_changed: 'lock',
      created: 'plus', updated: 'edit', deleted: 'trash',
      status_changed: 'refresh', status_update: 'refresh', resolved: 'check', closed: 'lock',
      rejected: 'x', escalated: 'escalated', reopened: 'refresh',
      assigned: 'user', claimed: 'user', comment_added: 'comment',
      feedback_submitted: 'star', feedback_deleted: 'trash',
      file_uploaded: 'upload', attachment_uploaded: 'upload', attachment_deleted: 'trash',
      user_created: 'user', user_updated: 'edit', user_deleted: 'trash',
      user_approved: 'check', user_blocked: 'lock', user_unblocked: 'check',
      profile_updated: 'edit', group_created: 'users', group_updated: 'users', group_deleted: 'trash',
      member_added: 'user', member_removed: 'user',
      company_created: 'company', company_updated: 'company', company_deleted: 'trash',
      settings_updated: 'settings', settings_reset: 'settings', logo_uploaded: 'upload', logo_removed: 'trash',
      notification_sent: 'bell', notification_read: 'bell', notification_deleted: 'trash',
      session_revoked: 'lock', priority_changed: 'refresh', category_changed: 'refresh',
      assigned_group_changed: 'users', request_viewed: 'eye', request_list_viewed: 'eye',
      dashboard_viewed: 'eye', report_viewed: 'eye', activity_log_viewed: 'eye',
      activity_cleared: 'trash', search_performed: 'search', priority_created: 'plus',
      status_created: 'plus', status_deleted: 'trash', status_toggled: 'refresh',
      announcement_created: 'plus', announcement_updated: 'edit', announcement_deleted: 'trash',
      kb_viewed: 'eye', kb_created: 'plus', kb_updated: 'edit', kb_deleted: 'trash',
      tag_created: 'plus', tag_updated: 'edit', tag_deleted: 'trash',
      template_created: 'plus', template_updated: 'edit', template_deleted: 'trash',
      sla_created: 'plus', sla_updated: 'edit', sla_deleted: 'trash',
      watcher_added: 'eye', watcher_removed: 'eye',
      maintenance_mode_changed: 'settings', role_changed: 'user'
    };
    return icons[type] || 'clipboard';
  };

  const getActivityColor = (type) => {
    const colors = {
      login_success: '#10B981', login_failed: '#EF4444', login_locked: '#EF4444', logout: '#6B7280',
      signup: '#3B82F6', google_login: '#3B82F6', google_signup: '#3B82F6',
      password_reset_requested: '#F59E0B', password_reset_completed: '#10B981', password_changed: '#F59E0B',
      created: '#8B5CF6', updated: '#3B82F6', deleted: '#EF4444',
      status_changed: '#F59E0B', status_update: '#F59E0B', resolved: '#10B981', closed: '#6B7280',
      rejected: '#EF4444', escalated: '#EC4899', reopened: '#3B82F6',
      assigned: '#EC4899', claimed: '#EC4899', comment_added: '#3B82F6',
      feedback_submitted: '#F59E0B', feedback_deleted: '#EF4444',
      file_uploaded: '#10B981', attachment_uploaded: '#10B981', attachment_deleted: '#EF4444',
      user_created: '#3B82F6', user_updated: '#3B82F6', user_deleted: '#EF4444',
      user_approved: '#10B981', user_blocked: '#EF4444', user_unblocked: '#10B981',
      profile_updated: '#3B82F6', group_created: '#3B82F6', group_updated: '#3B82F6', group_deleted: '#EF4444',
      member_added: '#10B981', member_removed: '#EF4444',
      company_created: '#3B82F6', company_updated: '#3B82F6', company_deleted: '#EF4444',
      settings_updated: '#6B7280', settings_reset: '#6B7280', logo_uploaded: '#10B981', logo_removed: '#EF4444',
      notification_sent: '#3B82F6', notification_read: '#10B981', notification_deleted: '#EF4444',
      session_revoked: '#EF4444', priority_changed: '#F59E0B', category_changed: '#F59E0B',
      assigned_group_changed: '#3B82F6', request_viewed: '#6B7280', request_list_viewed: '#6B7280',
      dashboard_viewed: '#6B7280', report_viewed: '#6B7280', activity_log_viewed: '#6B7280',
      activity_cleared: '#EF4444', search_performed: '#6B7280', priority_created: '#8B5CF6',
      status_created: '#8B5CF6', status_deleted: '#EF4444', status_toggled: '#F59E0B',
      announcement_created: '#8B5CF6', announcement_updated: '#3B82F6', announcement_deleted: '#EF4444',
      kb_viewed: '#6B7280', kb_created: '#8B5CF6', kb_updated: '#3B82F6', kb_deleted: '#EF4444',
      tag_created: '#8B5CF6', tag_updated: '#3B82F6', tag_deleted: '#EF4444',
      template_created: '#8B5CF6', template_updated: '#3B82F6', template_deleted: '#EF4444',
      sla_created: '#8B5CF6', sla_updated: '#3B82F6', sla_deleted: '#EF4444',
      watcher_added: '#6B7280', watcher_removed: '#6B7280',
      maintenance_mode_changed: '#6B7280', role_changed: '#EC4899'
    };
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
        <>
          <div className="activity-timeline">
            {activities.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}><Icon name="clipboard" size={48} /></div>
                <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>{t('common.noActivityYet')}</h3>
                <p style={{ margin: 0, fontSize: '14px' }}>{t('common.activityEmptyDesc')}</p>
              </div>
            ) : (
              paginatedActivities.map(a => (
                <div key={a.id} className="timeline-item" style={{ borderBottom: '1px solid var(--activity-separator, rgba(0,0,0,0.15))', filter: 'blur(0.3px)', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div className="timeline-icon" style={{ background: `linear-gradient(135deg, ${getActivityColor(a.type)} 0%, #1e293b 100%)`, color: '#fff' }}>
                    <Icon name={getActivityIcon(a.type)} size={18} />
                  </div>
                  <div className="timeline-content">
                    <div className="timeline-header">
                      <span className="timeline-action">{translateActivityMessage(a.message, a.type, t)}</span>
                      {a.requestId && <span className="timeline-request">#{a.requestId}</span>}
                    </div>
                    <div className="timeline-meta">
                      <span className="timeline-user">{a.user?.name || t('common.unknown')}</span>
                      <span className="timeline-time">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {!loading && activities.length > 0 && (
            <div className="table-footer">
              <div className="table-footer-info">
                <span>{t('common.show')}</span>
                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>{t('common.of')} {activities.length} {t('common.activities')}</span>
              </div>
              <div className="table-pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
                <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button>
                <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
