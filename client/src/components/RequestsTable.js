import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { showStatusToast } from '../notify';

const RequestsTable = forwardRef(function RequestsTable({
  user,
  title = 'All Requests',
  basePath = '',
  emptyMessage,
  initialFilter = {},
  onDataChange
}, ref) {
  const navigate = useNavigate();
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
      setError('Failed to load requests: ' + err.message);
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
      showStatusToast(`Request #${id} deleted`, 'request_deleted', id);
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast('Failed to delete request: ' + err.message, 'error');
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
      showStatusToast('Request claimed successfully', 'assignment', requestId);
    } catch (err) {
      showStatusToast('Failed to claim: ' + err.message, 'error');
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
      showStatusToast(`Request #${requestId} marked as ${statusName}`, 'status', requestId);
    } catch (err) {
      showStatusToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const quickActions = (r) => {
    if (isReadOnly(r) || !isDeveloper) return [];
    const statusName = r.status?.name;
    const actions = [];
    if (statusName === 'New') {
      actions.push({ label: 'Claim', status: 'Assigned', color: '#8B5CF6', icon: '👤', type: 'claim' });
    }
    if (statusName === 'Assigned') {
      actions.push({ label: 'Start Work', status: 'In Progress', color: '#F59E0B', icon: '▶' });
    }
    if (statusName === 'In Progress') {
      actions.push({ label: 'Resolve', status: 'Resolved', color: '#10B981', icon: '✓' });
      actions.push({ label: 'Waiting for Client', status: 'Waiting for Client', color: '#F97316', icon: '❓' });
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
        return (
          String(r.id).includes(q) ||
          (r.subject || '').toLowerCase().includes(q) ||
          (r.category?.name || '').toLowerCase().includes(q) ||
          (r.client?.name || '').toLowerCase().includes(q) ||
          (r.groups || []).some(g => (g.name || '').toLowerCase().includes(q)) ||
          (r.assignedGroup?.name || '').toLowerCase().includes(q)
        );
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
          <button onClick={() => { setError(''); loadData(); }} style={{ background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <>
          <div className="table-header-bar">
            <h3>{showMyTasks ? 'My Requests' : title} ({filteredRequests.length})</h3>
            <div className="table-header-actions">
              {(isDeveloper || isSupport) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer', marginRight: '8px', userSelect: 'none' }}>
                  <span>Show My Tasks</span>
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
                <option value="">All Priorities</option>
                {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <select className="filter-select" value={filter.category} onChange={(e) => { setFilter(f => ({ ...f, category: e.target.value })); setPage(1); }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              <select className="filter-select" value={filter.status} onChange={(e) => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}>
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <div className="table-search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search requests..." value={filter.search} onChange={(e) => { setFilter(f => ({ ...f, search: e.target.value })); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>ID</span> {getSortIcon('id')}</th>
                  <th className="sortable"><span onClick={() => handleSort('subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>Request Title</span> {getSortIcon('subject')}</th>
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('assignee')} style={{ cursor: 'pointer', userSelect: 'none' }}>Assigned To</span> {getSortIcon('assignee')}</th>}
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>Client</span> {getSortIcon('client')}</th>}
                  {!isClient && <th className="sortable"><span onClick={() => handleSort('groups')} style={{ cursor: 'pointer', userSelect: 'none' }}>Assigned Group</span> {getSortIcon('groups')}</th>}
                  <th className="sortable"><span onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>Category</span> {getSortIcon('category')}</th>
                  <th className="sortable"><span onClick={() => handleSort('priority')} style={{ cursor: 'pointer', userSelect: 'none' }}>Priority</span> {getSortIcon('priority')}</th>
                  <th className="sortable"><span onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Status</span> {getSortIcon('status')}</th>
                  <th className="sortable"><span onClick={() => handleSort('updatedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>Updated</span> {getSortIcon('updatedAt')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                    {displayRequests.length === 0 ? (showMyTasks ? 'No requests assigned to you.' : (emptyMessage || 'No requests yet.')) : 'No requests match your filters.'}
                  </td></tr>
                )}
                {paginated.map(r => (
                  <tr key={r.id} onClick={() => navigate(`${basePath}/requests/${r.id}`)} className="clickable-row" style={isReadOnly(r) ? { opacity: 0.75 } : {}}>
                    <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                    <td>{r.subject}{isReadOnly(r) && <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>(read-only)</span>}</td>
                    {!isClient && (
                      <td>
                        {r.assignee && r.status?.name !== 'New' ? (
                          <div className="assigned-user-cell">
                            <div className="assigned-avatar" style={{ background: '#3B82F6' }}>{r.assignee.name.charAt(0)}</div>
                            <span>{r.assignee.name}</span>
                          </div>
                        ) : <span style={{ color: '#9ca3af' }}>-</span>}
                      </td>
                    )}
                    {!isClient && <td>{r.client?.name || '-'}</td>}
                    {!isClient && (
                      <td>
                        {r.groups && r.groups.length > 0
                          ? r.groups.map((g, i) => (
                              <span key={g.id} className="group-tag" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', marginRight: i < r.groups.length - 1 ? '4px' : 0 }}>
                                {g.name}
                              </span>
                            ))
                          : '-'}
                      </td>
                    )}
                    <td><span className="category-tag" style={{ background: (r.category?.color || '#3B82F6') + '20', color: r.category?.color || '#3B82F6' }}>{r.category?.name || '-'}</span></td>
                    <td><span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>{r.priority?.name || '-'}</span></td>
                    <td><span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>{r.status?.name || '-'}</span></td>
                    <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                    <td>
                      <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                        {isReadOnly(r) ? (
                          <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>Read only</span>
                        ) : isDeveloper ? (
                          quickActions(r).map((action, i) =>
                            action.type === 'claim' ? (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `claim-${r.id}`} onClick={(e) => handleClaim(e, r.id)} style={{ opacity: updatingId === `claim-${r.id}` ? 0.6 : 1 }}>
                                {action.icon} {action.label}
                              </button>
                            ) : (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `status-${r.id}`} onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)} style={{ opacity: updatingId === `status-${r.id}` ? 0.6 : 1 }}>
                                {action.icon} {action.label}
                              </button>
                            )
                          )
                        ) : (user?.role === 'admin' || user?.role === 'support') && (r.statusId === '1' || r.statusId === '2') ? (
                          <>
                            <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>Edit</button>
                            <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>Delete</button>
                          </>
                        ) : isClient && r.statusId === '1' ? (
                          <>
                            <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>Edit</button>
                            <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>Delete</button>
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
              <span>Show</span>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>of {filteredRequests.length} requests</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>›</button>
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>Are you sure you want to delete this request?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default RequestsTable;
