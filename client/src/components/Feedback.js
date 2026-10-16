import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import PageNumbers from './PageNumbers';
import Icon from './Icon';
import ClientSatisfaction from './ClientSatisfaction';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';
import { API_BASE } from '../api';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

const roleColors = {
  admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981'
};

export default function Feedback() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/feedback'));
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [satisfactionFilter, setSatisfactionFilter] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { t } = useTranslation();

  const addToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { loadFeedback(); }, []);

  const loadFeedback = () => {
    setError('');
    setLoading(true);
    api.get('/api/feedback').then(data => {
      setFeedback(data);
      setLoading(false);
    }).catch(err => { setError(t('feedback.loadFailed') + ': ' + err.message); setLoading(false); });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/feedback/${id}`);
      loadFeedback();
      addToast(t('feedback.deletedSuccess'));
      showStatusToast(t('feedback.deleted'), 'request_deleted');
      setDeleteTarget(null);
    } catch (err) {
      setError(t('feedback.deleteFailed') + ': ' + err.message);
      addToast(t('feedback.deleteFailed') + ': ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const handleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const satisfactionKeyFor = (rating) => {
    const num = Number(rating) || 0;
    if (num >= 4.5) return 'verySatisfied';
    if (num >= 3.5) return 'satisfied';
    if (num >= 2.5) return 'neutral';
    if (num >= 1.5) return 'dissatisfied';
    return 'veryDissatisfied';
  };

  const filtered = feedback.filter(f => {
    if (satisfactionFilter && satisfactionKeyFor(f.rating) !== satisfactionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (f.user_name || '').toLowerCase().includes(q) ||
      (f.request_subject || '').toLowerCase().includes(q) ||
      (f.comment || '').toLowerCase().includes(q) ||
      (f.request_id || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    if (!sort.key) return 0;
    let aVal, bVal;
    switch (sort.key) {
      case 'id': aVal = a.id || 0; bVal = b.id || 0; break;
      case 'rating': aVal = a.rating || 0; bVal = b.rating || 0; break;
      case 'user_name': aVal = (a.user_name || '').toLowerCase(); bVal = (b.user_name || '').toLowerCase(); break;
      case 'comment': aVal = (a.comment || '').toLowerCase(); bVal = (b.comment || '').toLowerCase(); break;
      case 'request_subject': aVal = (a.request_subject || '').toLowerCase(); bVal = (b.request_subject || '').toLowerCase(); break;
      case 'created_at': aVal = a.created_at || ''; bVal = b.created_at || ''; break;
      default: return 0;
    }
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  // Keep current page valid when page size / filters change.
  useEffect(() => {
    if (typeof totalPages === 'number' && totalPages > 0 && page > totalPages) setPage(totalPages);
    else if (typeof totalPages === 'number' && totalPages === 0 && page !== 1) setPage(1);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const Star = ({ filled }) => (
    <svg width="18" height="18" viewBox="0 0 20 20" fill={filled ? '#F59E0B' : '#e5e7eb'} style={{ display: 'inline-block' }}>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  const renderStars = (rating) => (
    <span style={{ display: 'inline-flex', gap: '2px', verticalAlign: 'middle' }}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= Math.round(Number(rating) || 0)} />)}
    </span>
  );

  const renderRating = (rating) => {
    const num = Number(rating) || 0;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
        <strong className="feedback-rating-num">{num.toFixed(1)}</strong>
        {renderStars(num)}
      </span>
    );
  };

  const satisfactionFor = (rating) => {
    const num = Number(rating) || 0;
    if (num >= 4.5) return { key: 'verySatisfied', color: '#047857' };
    if (num >= 3.5) return { key: 'satisfied', color: '#22C55E' };
    if (num >= 2.5) return { key: 'neutral', color: '#F59E0B' };
    if (num >= 1.5) return { key: 'dissatisfied', color: '#F97316' };
    return { key: 'veryDissatisfied', color: '#DC2626' };
  };

  const getSortIcon = (key) => {
    const isActive = sort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('feedback.title')}</h1>
          <p>{t('feedback.subtitle')}</p>
        </div>
      </div>

      {error && <div style={{
        background: '#FEF2F2', color: '#DC2626', padding: '12px 16px',
        borderRadius: '8px', marginBottom: '16px', fontSize: '14px',
        border: '1px solid rgba(239,68,68,0.2)'
      }}>{error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : feedback.length === 0 ? (
        <div className="chart-card" style={{
          textAlign: 'center', padding: '60px 24px', color: '#94a3b8'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}><Icon name="feedback" size={48} /></div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#64748b' }}>{t('feedback.noFeedbackYet')}</h3>
          <p style={{ fontSize: '14px' }}>{t('feedback.noFeedbackDesc')}</p>
        </div>
      ) : (
        <>
          {/* Client Satisfaction — live analytics above the Feedback table */}
          <ClientSatisfaction feedback={feedback} />

          <div className="chart-card" style={{ marginTop: '24px' }}>
            <div className="filters-bar sf-toolbar">
              <div className="sf-toolbar-left">
                <div className="table-search-box">
                  <span className="search-icon"><Icon name="search" size={14} /></span>
                  <input type="text" placeholder={t('feedback.searchPlaceholder')} value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="sf-toolbar-right">
                <select className="filter-select" value={satisfactionFilter}
                  onChange={(e) => { setSatisfactionFilter(e.target.value); setPage(1); }}>
                  <option value="">{t('feedback.allSatisfaction')}</option>
                  <option value="verySatisfied">{t('feedback.verySatisfied')}</option>
                  <option value="satisfied">{t('feedback.satisfied')}</option>
                  <option value="neutral">{t('feedback.neutral')}</option>
                  <option value="dissatisfied">{t('feedback.dissatisfied')}</option>
                  <option value="veryDissatisfied">{t('feedback.veryDissatisfied')}</option>
                </select>
              </div>
            </div>
            <div className="table-header-bar">
              <h3>{t('feedback.listCount', { count: filtered.length })}</h3>
            </div>

            <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.id')} {getSortIcon('id')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('rating')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('feedback.rating')} {getSortIcon('rating')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('rating')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('feedback.satisfaction')} {getSortIcon('rating')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('comment')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('feedback.comment')} {getSortIcon('comment')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('user_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.user')} {getSortIcon('user_name')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('request_subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.request')} {getSortIcon('request_subject')}</span></th>
                    <th className="sortable"><span onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.date')} {getSortIcon('created_at')}</span></th>
                    <th style={{ width: '80px' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((f, i) => (
                    <tr key={f.id}>
                      <td><span className="feedback-cell-muted">
                        {(page - 1) * perPage + i + 1}
                      </span></td>
                      <td>{renderRating(f.rating)}</td>
                      <td>
                        {(() => {
                          const s = satisfactionFor(f.rating);
                          return (
                            <span className="role-badge" style={{ background: s.color + '20', color: s.color }}>
                              {t('feedback.' + s.key)}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="feedback-cell-comment">
                        {f.comment ? (
                          <span className="feedback-comment-text">
                            "{f.comment}"
                          </span>
                        ) : (
                          <span className="feedback-no-comment">{t('feedback.noComment')}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: roleColors.client || '#6B7280',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: '11px', fontWeight: 600, flexShrink: 0,
                            overflow: 'hidden'
                          }}>
                            {getAvatarUrl(f.user_avatar) ? <img src={getAvatarUrl(f.user_avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (f.user_name ? f.user_name.charAt(0).toUpperCase() : '?')}
                          </div>
                          <span className="truncate-cell feedback-cell-muted" style={{ fontWeight: 500 }}>
                            {f.user_name || <span className="feedback-no-comment">{t('feedback.anonymous')}</span>}
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '220px' }}>
                        {f.request_subject ? (
                          <a href={`/requests/${f.request_id}`}
                            onClick={(e) => { e.preventDefault(); window.location.href = `/requests/${f.request_id}`; }}
                            className="feedback-link truncate-cell"
                            style={{
                              textDecoration: 'none', fontSize: '13px',
                              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                            {f.request_subject}
                          </a>
                        ) : (
                          <span className="feedback-cell-muted" style={{ fontSize: '13px' }}>{f.request_id}</span>
                        )}
                        <div className="feedback-cell-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                          {f.request_id}
                        </div>
                      </td>
                      <td className="feedback-cell-muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(f.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </td>
                      <td>
                        <button className="action-btn-text delete"
                          onClick={() => setDeleteTarget(f)}
                          style={{ fontSize: '12px' }}>
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px' }}>
                        <span className="feedback-no-comment">{t('feedback.noMatch', { query: searchQuery })}</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <div className="table-footer-info">
                <span>{t('common.show')}</span>
                <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>{t('feedback.ofCount', { count: filtered.length })}</span>
              </div>
              <div className="table-pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
                <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
                <button className="page-btn" disabled={page === totalPages || totalPages === 0}
                  onClick={() => setPage(page + 1)}>›</button>
                <button className="page-btn" disabled={page === totalPages || totalPages === 0}
                  onClick={() => setPage(totalPages)}>»</button>
              </div>
            </div>
          </div>
        </>
      )}
      {!loading && feedback.length === 0 && !error && (
        <ClientSatisfaction feedback={feedback} />
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: '17px', lineHeight: 1.6, margin: '28px 24px 24px' }}>
              {t('feedback.deleteConfirm')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 28px' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}
                style={{ padding: '10px 24px' }}>{t('common.cancel')}</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteTarget.id)}
                style={{ padding: '10px 24px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
