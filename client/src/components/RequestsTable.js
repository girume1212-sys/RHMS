import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';
import PageNumbers from './PageNumbers';
import Icon from './Icon';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

const RequestsTable = forwardRef(function RequestsTable({
  user,
  title,
  basePath = '',
  emptyMessage,
  initialFilter = {},
  onDataChange
}, ref) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isClient = user?.role === 'client';
  const isDeveloper = user?.role === 'developer';
  const isSupport = user?.role === 'support';

  const [requests, setRequests] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [filter, setFilter] = useState({
    status: initialFilter.status || '',
    priority: initialFilter.priority || '',
    category: initialFilter.category || '',
    search: initialFilter.search || ''
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadData = useCallback(() => {
    Promise.all([
      api.get('/api/requests'),
      api.get('/api/statuses'),
      api.get('/api/priorities'),
      api.get('/api/categories')
    ]).then(([requestsData, statusesData, prioritiesData, categoriesData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      setPriorities(prioritiesData);
      setCategories(categoriesData);
      setError('');
      setLoading(false);
    }).catch(err => {
      setError(t('common.failedToLoadRequests') + ' ' + err.message);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('refresh-requests', handleRefresh);
    return () => window.removeEventListener('refresh-requests', handleRefresh);
  }, [loadData]);

  useEffect(() => {
    let status = initialFilter.status || '';
    if (status && /^\d+$/.test(status)) {
      const s = statuses.find(st => st.id === status);
      status = s ? s.name : '';
    }
    let category = initialFilter.category || '';
    if (category && /^\d+$/.test(category)) {
      const c = categories.find(cat => cat.id === category);
      category = c ? c.name : '';
    }
    setFilter({
      status,
      priority: initialFilter.priority || '',
      category,
      search: initialFilter.search || ''
    });
    setPage(1);
  }, [initialFilter.status, initialFilter.priority, initialFilter.category, initialFilter.search, statuses, categories]);

  useEffect(() => {
    if (onDataChange) onDataChange({ requests, statuses, showMyTasks, filter });
  }, [onDataChange, requests, statuses, showMyTasks, filter]);

  useImperativeHandle(ref, () => ({
    setStatusFilter: (name) => {
      setFilter(f => ({ ...f, status: name }));
      setPage(1);
    }
  }), []);

  const isReadOnly = (r) => {
    if (user?.role === 'admin') return false;
    if (user?.role === 'client') return false;
    return r.assignedTo && r.assignedTo !== user.id;
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444', Rejected: '#DC2626', Escalated: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast(t('common.requestDeletedWithId', { id }), 'request_deleted', id);
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast(t('common.failedToDeleteRequest') + ': ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const handleEdit = (e, id) => {
    e.stopPropagation();
    navigate(`${basePath}/requests/${id}?edit=true`);
  };

  const handleClaim = async (e, requestId) => {
    e.stopPropagation();
    setUpdatingId(`claim-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}/claim`);
      const assignedStatus = statuses.find(s => s.name === 'Assigned');
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assignedTo: user.id, assignee: { id: user.id, name: user.name }, status: assignedStatus || r.status, statusId: '2' } : r));
      showStatusToast(t('common.requestClaimed'), 'assignment', requestId);
    } catch (err) {
      showStatusToast(t('common.failedToClaim') + ': ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleQuickStatusUpdate = async (e, requestId, statusName) => {
    e.stopPropagation();
    const status = statuses.find(s => s.name === statusName);
    if (!status) return;
    setUpdatingId(`status-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { statusId: status.id });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status, statusId: status.id, assignedTo: statusName === 'New' ? null : r.assignedTo, assignee: statusName === 'New' ? null : r.assignee } : r));
      showStatusToast(t('common.requestMarkedStatus', { id: requestId, status: statusName }), 'status', requestId);
    } catch (err) {
      showStatusToast(t('common.failedToUpdateStatus') + ': ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const quickActions = (r) => {
    if (isReadOnly(r) || !isDeveloper) return [];
    const statusName = r.status?.name;
    const actions = [];
    if (statusName === 'New') {
      actions.push({ label: t('common.claim'), status: 'Assigned', color: '#8B5CF6', icon: 'user', type: 'claim' });
    }
    if (statusName === 'Assigned') {
      actions.push({ label: t('common.startWork'), status: 'In Progress', color: '#F59E0B', icon: 'play' });
    }
    if (statusName === 'In Progress') {
      actions.push({ label: t('common.waitingForClient'), status: 'Waiting for Client', color: '#F97316', icon: 'help' });
    }
    if (statusName === 'Waiting for Client') {
      actions.push({ label: t('common.resolve'), status: 'Resolved', color: '#10B981', icon: 'check' });
    }
    return actions;
  };

  const handleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const getSortIcon = (key) => {
    const isActive = sort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const displayRequests = showMyTasks
    ? requests.filter(r => r.assignedTo === user.id && r.status?.name !== 'New')
    : requests;

  const filteredRequests = displayRequests
    .filter(r => {
      if (filter.status && r.status?.name !== filter.status) return false;
      if (filter.priority && r.priority?.name !== filter.priority) return false;
      if (filter.category && r.category?.name !== filter.category) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const str = (v) => (v === undefined || v === null) ? '' : String(v).toLowerCase();
        return [
          str(r.id),
          str(r.subject),
          str(r.description),
          str(r.status?.name),
          str(r.priority?.name),
          str(r.category?.name),
          str(r.client?.name),
          str(r.assignee?.name),
          str(r.assignedGroup?.name),
          ...(r.groups || []).map(g => str(g.name)),
          r.createdAt ? str(new Date(r.createdAt).toLocaleString()) : '',
          r.updatedAt ? str(new Date(r.updatedAt).toLocaleString()) : ''
        ].some(s => s.includes(q));
      }
      return true;
    })
    .sort((a, b) => {
      if (!sort.key) return 0;
      let aVal, bVal;
      switch (sort.key) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'subject': aVal = (a.subject || '').toLowerCase(); bVal = (b.subject || '').toLowerCase(); break;
        case 'assignee': aVal = (a.assignee?.name || '').toLowerCase(); bVal = (b.assignee?.name || '').toLowerCase(); break;
        case 'client': aVal = (a.client?.name || '').toLowerCase(); bVal = (b.client?.name || '').toLowerCase(); break;
        case 'groups': aVal = (a.groups?.[0]?.name || '').toLowerCase(); bVal = (b.groups?.[0]?.name || '').toLowerCase(); break;
        case 'assignedGroup': aVal = (a.assignedGroup?.name || '').toLowerCase(); bVal = (b.assignedGroup?.name || '').toLowerCase(); break;
        case 'category': aVal = (a.category?.name || '').toLowerCase(); bVal = (b.category?.name || '').toLowerCase(); break;
        case 'priority': aVal = a.priority?.level || 0; bVal = b.priority?.level || 0; break;
        case 'status': aVal = (a.status?.name || '').toLowerCase(); bVal = (b.status?.name || '').toLowerCase(); break;
        case 'updatedAt': aVal = new Date(a.updatedAt || 0); bVal = new Date(b.updatedAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredRequests.length / perPage);
  const paginated = filteredRequests.slice((page - 1) * perPage, page * perPage);
  const colSpan = isClient ? 7 : 10;

  return (
    <div className="chart-card">
      {error && (
        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', margin: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button onClick={() => { setError(''); loadData(); }} style={{ background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>{t('common.retry')}</button>
        </div>
      )}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <>
          <div className="table-header-bar">
            <h3>{showMyTasks ? t('common.myRequests') : (title || t('common.allRequests'))} ({filteredRequests.length})</h3>
            <div className="table-header-actions">
              {(isDeveloper || isSupport) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer', marginRight: '8px', userSelect: 'none' }}>
                  <span>{t('common.showMyTasks')}</span>
                  <div
                    onClick={() => { setShowMyTasks(!showMyTasks); setPage(1); }}
                    style={{
                      width: '40px', height: '22px', borderRadius: '11px',
                      background: showMyTasks ? '#8B5CF6' : '#D1D5DB',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '2px',
                      left: showMyTasks ? '20px' : '2px',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </label>
              )}
              <select className="filter-select" value={filter.priority} onChange={(e) => { setFilter(f => ({ ...f, priority: e.target.value })); setPage(1); }}>
                <option value="">{t('common.allPriorities')}</option>
                {priorities.map(p => <option key={p.id} value={p.name}>{transSeeded(p.name, 'priority', t)}</option>)}
              </select>
              <select className="filter-select" value={filter.category} onChange={(e) => { setFilter(f => ({ ...f, category: e.target.value })); setPage(1); }}>
                <option value="">{t('common.allCategories')}</option>
                {categories.map(c => <option key={c.id} value={c.name}>{transSeeded(c.name, 'category', t)}</option>)}
              </select>
              <select className="filter-select" value={filter.status} onChange={(e) => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}>
                <option value="">{t('common.allStatuses')}</option>
                {statuses.map(s => <option key={s.id} value={s.name}>{transSeeded(s.name, 'status', t)}</option>)}
              </select>
              <div className="table-search-box">
                <span className="search-icon"><Icon name="search" size={14} /></span>
                <input type="text" placeholder={t('common.searchRequests')} value={filter.search} onChange={(e) => { setFilter(f => ({ ...f, search: e.target.value })); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.id')} {getSortIcon('id')}</span></th>
                  <th className="sortable"><span onClick={() => handleSort('subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.requestTitle')} {getSortIcon('subject')}</span></th>
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('assignee')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.assignedTo')} {getSortIcon('assignee')}</span></th>}
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.client')} {getSortIcon('client')}</span></th>}
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('groups')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.assignedGroup')} {getSortIcon('groups')}</span></th>}
                  <th className="sortable"><span onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.category')} {getSortIcon('category')}</span></th>
                  <th className="sortable"><span onClick={() => handleSort('priority')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.priority')} {getSortIcon('priority')}</span></th>
                  <th className="sortable"><span onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.status')} {getSortIcon('status')}</span></th>
                  <th className="sortable"><span onClick={() => handleSort('updatedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.updated')} {getSortIcon('updatedAt')}</span></th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                    {displayRequests.length === 0 ? (showMyTasks ? t('common.noAssignedRequests') : (emptyMessage || t('common.noRequestsYet'))) : t('common.noMatchFilters')}
                  </td></tr>
                )}
                {paginated.map(r => (
                  <tr key={r.id} onClick={() => navigate(`${basePath}/requests/${r.id}`)} className="clickable-row" style={isReadOnly(r) ? { opacity: 0.75 } : {}}>
                    <td><strong>{t('common.requestPrefixLabel')}{String(r.id).padStart(4, '0')}</strong></td>
                    <td><span className="truncate-cell">{r.subject}</span>{isReadOnly(r) && <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>({t('common.readOnly')})</span>}</td>
                    {!isClient && (
                      <td>
                        {r.assignee && r.status?.name !== 'New' ? (
                          <div className="assigned-user-cell">
                            <div className="assigned-avatar" style={{ background: '#3B82F6', overflow: 'hidden' }}>{getAvatarUrl(r.assignee.avatar) ? <img src={getAvatarUrl(r.assignee.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.assignee.name.charAt(0)}</div>
                            <span className="truncate-cell">{r.assignee.name}</span>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                    )}
                    {!isClient && (
                      <td>
                        {r.clientDeleted ? (
                          <span className="muted-text">{t('common.clientDeleted')}</span>
                        ) : r.client?.name ? (
                          <div className="assigned-user-cell">
                            <div className="assigned-avatar" style={{ background: '#10B981', overflow: 'hidden' }}>
                              {getAvatarUrl(r.client?.avatar) ? <img src={getAvatarUrl(r.client?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (r.client?.name.charAt(0) || '?')}
                            </div>
                            <span className="truncate-cell">{r.client?.name}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>-</span>
                        )}
                      </td>
                    )}
                    {!isClient && (
                      <td>
                        {r.groups && r.groups.length > 0
                          ? <span className="truncate-cell">{r.groups.map((g, i) => (
                              <span key={g.id} className="group-tag" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', marginRight: i < r.groups.length - 1 ? '4px' : 0 }}>
                                {g.name}
                              </span>
                            ))}</span>
                          : '-'}
                      </td>
                    )}
                    <td><span className="truncate-cell"><span className="category-tag" style={{ background: (r.category?.color || '#3B82F6') + '20', color: r.category?.color || '#3B82F6' }}>{transSeeded(r.category?.name, 'category', t) || '-'}</span></span></td>
                    <td><span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>{transSeeded(r.priority?.name, 'priority', t) || '-'}</span></td>
                    <td><span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>{transSeeded(r.status?.name, 'status', t) || '-'}</span></td>
                    <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                    <td>
                      <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                        {isReadOnly(r) ? (
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
                        ) : isDeveloper ? (
                          quickActions(r).map((action, i) =>
                            action.type === 'claim' ? (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `claim-${r.id}`} onClick={(e) => handleClaim(e, r.id)} style={{ opacity: updatingId === `claim-${r.id}` ? 0.6 : 1 }}>
                                <Icon name={action.icon} size={14} /> {action.label}
                              </button>
                            ) : (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `status-${r.id}`} onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)} style={{ opacity: updatingId === `status-${r.id}` ? 0.6 : 1 }}>
                                <Icon name={action.icon} size={14} /> {action.label}
                              </button>
                            )
                          )
                        ) : user?.role === 'admin' && (r.statusId === '1' || r.statusId === '2') ? (
                          <>
                            <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>{t('common.edit')}</button>
                            <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>{t('common.delete')}</button>
                          </>
                        ) : isClient && r.statusId === '1' ? (
                          <>
                            <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>{t('common.edit')}</button>
                            <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>{t('common.delete')}</button>
                          </>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="table-footer-info">
              <span>{t('common.show')}</span>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>{t('common.ofRequests', { count: filteredRequests.length })}</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
              <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>›</button>
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>{t('common.deleteRequestConfirm')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteTarget)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RequestsTable;
