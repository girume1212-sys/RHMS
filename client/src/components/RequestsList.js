import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function RequestsList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState({
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || ''
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showMyRequests, setShowMyRequests] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const navigate = useNavigate();

  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.priority) params.set('priority', filter.priority);
    if (filter.category) params.set('category', filter.category);
    if (filter.search) params.set('search', filter.search);
    if (user?.role === 'developer' || user?.role === 'support') {
      params.set('myRequests', showMyRequests ? 'true' : 'false');
    }
    const qs = params.toString();
    setError('');
    Promise.all([
      api.get(`/api/requests?${qs}`),
      api.get('/api/statuses')
    ]).then(([requestsData, statusesData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      setLoading(false);
    }).catch(err => {
      setError('Failed to load requests: ' + err.message);
      setLoading(false);
    });
  }, [filter, user, showMyRequests]);

  const isReadOnly = (r) => {
    if (user?.role === 'admin') return false;
    if (user?.role === 'client') return false;
    return r.assignedTo && r.assignedTo !== user.id;
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444', Rejected: '#DC2626' };
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
      addToast('Request deleted successfully!');
      showStatusToast(`Request #${id} deleted`, 'request_deleted', id);
      setDeleteTarget(null);
    } catch (err) {
      setError('Failed to delete request: ' + err.message);
      addToast('Failed to delete request: ' + err.message, 'error');
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
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: status, statusId: status.id } : r));
      showStatusToast(`Request #${requestId} marked as ${statusName}`, 'status', requestId);
    } catch (err) {
      showStatusToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const getDeveloperActions = (r) => {
    const statusName = r.status?.name;
    const actions = [];
    if (statusName === 'New') {
      actions.push({ label: 'Claim', color: '#8B5CF6', type: 'claim' });
    }
    if (statusName === 'Assigned') {
      actions.push({ label: 'Start Work', status: 'In Progress', color: '#F59E0B' });
    }
    if (statusName === 'In Progress') {
      actions.push({ label: 'Resolve', status: 'Resolved', color: '#10B981' });
      actions.push({ label: 'Need Info', status: 'Waiting for Client', color: '#F97316' });
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

  const filteredRequests = requests
    .filter(r => {
      if (filter.search) {
        const q = filter.search.toLowerCase();
        return (
          String(r.id).includes(q) ||
          (r.subject || '').toLowerCase().includes(q) ||
          (r.client?.name || '').toLowerCase().includes(q) ||
          (r.category?.name || '').toLowerCase().includes(q) ||
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
        case 'client': aVal = (a.client?.name || '').toLowerCase(); bVal = (b.client?.name || '').toLowerCase(); break;
        case 'category': aVal = (a.category?.name || '').toLowerCase(); bVal = (b.category?.name || '').toLowerCase(); break;
        case 'priority': aVal = a.priority?.level || 0; bVal = b.priority?.level || 0; break;
        case 'status': aVal = (a.status?.name || '').toLowerCase(); bVal = (b.status?.name || '').toLowerCase(); break;
        case 'groups': aVal = (a.groups?.[0]?.name || '').toLowerCase(); bVal = (b.groups?.[0]?.name || '').toLowerCase(); break;
        case 'assignedGroup': aVal = (a.assignedGroup?.name || '').toLowerCase(); bVal = (b.assignedGroup?.name || '').toLowerCase(); break;
        case 'assignee': aVal = (a.assignee?.name || '').toLowerCase(); bVal = (b.assignee?.name || '').toLowerCase(); break;
        case 'createdAt': aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredRequests.length / perPage);
  const paginated = filteredRequests.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => navigate(basePath || '/')}>← Back</button>
          <h1>Requests</h1>
          <p>{isClient ? 'View your support requests' : 'Manage all support requests'}</p>
        </div>
        {(isClient || user?.role === 'admin') && (
          <button className="btn btn-primary" onClick={() => navigate(`${basePath}/requests/create`)}>
            + Create Request
          </button>
        )}
      </div>

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search requests..."
          className="filter-search"
          value={filter.search}
          onChange={(e) => { setFilter({ ...filter, search: e.target.value }); setPage(1); }}
        />
        <select value={filter.status} onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="1">New</option>
          <option value="2">Assigned</option>
          <option value="3">In Progress</option>
          <option value="4">Waiting for Client</option>
          <option value="5">Resolved</option>
          <option value="6">Closed</option>
          <option value="7">Reopened</option>
          <option value="9">Escalated</option>
        </select>
        <select value={filter.priority} onChange={(e) => { setFilter({ ...filter, priority: e.target.value }); setPage(1); }}>
          <option value="">All Priorities</option>
          <option value="1">Low</option>
          <option value="2">Medium</option>
          <option value="3">High</option>
          <option value="4">Critical</option>
        </select>
        <select value={filter.category} onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}>
          <option value="">All Categories</option>
          <option value="1">Hardware</option>
          <option value="2">Software</option>
          <option value="3">Network</option>
          <option value="4">Security</option>
          <option value="5">Email</option>
          <option value="6">Account</option>
          <option value="7">Data</option>
          <option value="8">Other</option>
        </select>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="table-header-bar">
            <h3>{showMyRequests ? 'My Requests' : 'All Requests'} ({filteredRequests.length})</h3>
            <div className="table-header-actions">
              {(user?.role === 'developer' || user?.role === 'support') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer', marginRight: '8px', userSelect: 'none' }}>
                  <span>My Requests</span>
                  <div
                    onClick={() => { setShowMyRequests(!showMyRequests); setPage(1); }}
                    style={{
                      width: '40px', height: '22px', borderRadius: '11px',
                      background: showMyRequests ? '#8B5CF6' : '#D1D5DB',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '2px',
                      left: showMyRequests ? '20px' : '2px',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" style={{ width: 70 }}>ID {getSortIcon('id')}</th>
                  <th className="sortable">Request Title {getSortIcon('subject')}</th>
                  {!isClient && <th className="sortable" style={{ width: 110 }}>Client {getSortIcon('client')}</th>}
                  {!isClient && <th className="sortable" style={{ width: 90 }}>Group {getSortIcon('groups')}</th>}
                  {!isClient && <th className="sortable" style={{ width: 100 }}>Assigned Group {getSortIcon('assignedGroup')}</th>}
                  <th className="sortable" style={{ width: 90 }}>Category {getSortIcon('category')}</th>
                  <th className="sortable" style={{ width: 75 }}>Priority {getSortIcon('priority')}</th>
                  <th className="sortable" style={{ width: 85 }}>Status {getSortIcon('status')}</th>
                  {!isClient && <th className="sortable" style={{ width: 110 }}>Assigned To {getSortIcon('assignee')}</th>}
                  <th className="sortable" style={{ width: 105 }}>Created {getSortIcon('createdAt')}</th>
                  <th style={{ width: 110 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={isClient ? 7 : 11} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No requests found</td></tr>
                )}
                {paginated.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`${basePath}/requests/${r.id}`)} className="clickable-row">
                    <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                    <td>{r.subject}</td>
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
                    {!isClient && (
                      <td>
                        {r.assignedGroup ? (
                          <span className="group-tag" style={{ background: (r.assignedGroup.color || '#6B7280') + '20', color: r.assignedGroup.color || '#6B7280' }}>
                            {r.assignedGroup.name}
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    <td><span className="category-tag">{r.category?.name || '-'}</span></td>
                    <td><span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>{r.priority?.name || '-'}</span></td>
                    <td><span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>{r.status?.name || '-'}</span></td>
                    {!isClient && <td>{r.assignee ? (
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: '#3B82F6' }}>{r.assignee.name.charAt(0)}</div>
                        <span>{r.assignee.name}</span>
                      </div>
                    ) : <span style={{ color: '#9ca3af' }}>-</span>}</td>}
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                    <td>
                      <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                        {isReadOnly(r) ? (
                          <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>Read only</span>
                        ) : user?.role === 'developer' ? (
                          getDeveloperActions(r).map((action, i) =>
                            action.type === 'claim' ? (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `claim-${r.id}`} onClick={(e) => handleClaim(e, r.id)} style={{ opacity: updatingId === `claim-${r.id}` ? 0.6 : 1 }}>
                                {action.label}
                              </button>
                            ) : (
                              <button key={`da-${i}`} className="action-btn-text edit" disabled={updatingId === `status-${r.id}`} onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)} style={{ opacity: updatingId === `status-${r.id}` ? 0.6 : 1 }}>
                                {action.label}
                              </button>
                            )
                          )
                        ) : (user?.role === 'admin' || user?.role === 'support') && (r.statusId === '1' || r.statusId === '2') ? (
                          <>
                            <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>Edit</button>
                            <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>Delete</button>
                          </>
                        ) : user?.role === 'client' && r.statusId === '1' ? (
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
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', background: '#1e293b' }}>
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
}
