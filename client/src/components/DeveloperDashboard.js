import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { showStatusToast } from '../notify';

export default function DeveloperDashboard() {
  const [requests, setRequests] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [activityLog, setActivityLog] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    const handleRefresh = () => loadData();
    window.addEventListener('refresh-requests', handleRefresh);
    return () => window.removeEventListener('refresh-requests', handleRefresh);
  }, []);

  const loadData = () => {
    Promise.all([
      api.get(`/api/requests?myRequests=${showAssignedOnly}`),
      api.get('/api/statuses'),
      api.get('/api/activity')
    ]).then(([requestsData, statusesData, activityData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      setActivityLog(activityData);
    }).catch(err => setError('Failed to load data: ' + err.message));
  };

  useEffect(() => {
    loadData();
  }, [showAssignedOnly]);

  const displayRequests = requests;

  const stats = {
    total: displayRequests.length,
    newCount: displayRequests.filter(r => r.status?.name === 'New').length,
    inProgress: displayRequests.filter(r => r.status?.name === 'In Progress').length,
    waiting: displayRequests.filter(r => r.status?.name === 'Waiting for Client').length,
    resolved: displayRequests.filter(r => r.status?.name === 'Resolved').length,
    assigned: displayRequests.filter(r => r.status?.name === 'Assigned').length,
    escalated: displayRequests.filter(r => r.status?.name === 'Escalated').length,
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Escalated: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const handleQuickStatusUpdate = async (e, requestId, statusName) => {
    e.stopPropagation();
    const status = statuses.find(s => s.name === statusName);
    if (!status) return;
    setUpdatingId(`status-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { statusId: status.id });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: status } : r));
      showStatusToast(`Request #${requestId} marked as ${statusName}`, 'status', requestId);
    } catch (err) {
      showStatusToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClaim = async (e, requestId) => {
    e.stopPropagation();
    setUpdatingId(`claim-${requestId}`);
    try {
      const data = await api.put(`/api/requests/${requestId}/claim`);
      const assignedStatus = statuses.find(s => s.name === 'Assigned');
      setRequests(prev => prev.filter(r => r.id !== requestId));
      showStatusToast('Request claimed successfully', 'assignment', requestId);
      loadData();
    } catch (err) {
      showStatusToast('Failed to claim: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast('Request deleted successfully', 'success');
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast('Failed to delete request: ' + err.message, 'error');
      setDeleteTarget(null);
    }
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

  const filteredRequests = displayRequests
    .filter(r => {
      if (statusFilter && r.status?.name !== statusFilter) return false;
      if (priorityFilter && r.priority?.name !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
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
  const paginatedRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

  const isReadOnly = (r) => r.assignedTo && r.assignedTo !== user.id;

  const quickActions = (r) => {
    if (isReadOnly(r)) return [];
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
      actions.push({ label: 'Need Info', status: 'Waiting for Client', color: '#F97316', icon: '❓' });
    }
    return actions;
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
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
          {error}
          <button onClick={() => { setError(''); loadData(); }} style={{ marginLeft: '12px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <DevStatCard icon="📥" value={stats.newCount} label="New" color="#3B82F6" onClick={() => setStatusFilter(statusFilter === 'New' ? '' : 'New')} />
        <DevStatCard icon="📋" value={stats.assigned} label="Newly Assigned" color="#8B5CF6" onClick={() => setStatusFilter(statusFilter === 'Assigned' ? '' : 'Assigned')} />
        <DevStatCard icon="⚡" value={stats.inProgress} label="In Progress" color="#F59E0B" onClick={() => setStatusFilter(statusFilter === 'In Progress' ? '' : 'In Progress')} />
        <DevStatCard icon="⏳" value={stats.waiting} label="Awaiting Client" color="#F97316" onClick={() => setStatusFilter(statusFilter === 'Waiting for Client' ? '' : 'Waiting for Client')} />
        <DevStatCard icon="🚨" value={stats.escalated} label="Escalated" color="#EF4444" onClick={() => setStatusFilter(statusFilter === 'Escalated' ? '' : 'Escalated')} />
        <DevStatCard icon="✅" value={stats.resolved} label="Resolved" color="#10B981" onClick={() => setStatusFilter(statusFilter === 'Resolved' ? '' : 'Resolved')} />
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <h3>{showAssignedOnly ? 'My Requests' : 'All Requests'} ({filteredRequests.length})</h3>
          <div className="table-header-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer', marginRight: '8px', userSelect: 'none' }}>
              <span>Show My Tasks</span>
              <div
                onClick={() => { setShowAssignedOnly(!showAssignedOnly); setPage(1); }}
                style={{
                  width: '40px', height: '22px', borderRadius: '11px',
                  background: showAssignedOnly ? '#8B5CF6' : '#D1D5DB',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                  flexShrink: 0
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: 'white', position: 'absolute', top: '2px',
                  left: showAssignedOnly ? '20px' : '2px',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </div>
            </label>
            <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {statuses.filter(s => s.name !== 'Closed' && s.name !== 'Reopened').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="filter-select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <div className="table-search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Search requests..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>

        <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>ID</span> {getSortIcon('id')}</th>
                <th className="sortable"><span onClick={() => handleSort('subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>Request Title</span> {getSortIcon('subject')}</th>
                <th className="sortable"><span onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>Client</span> {getSortIcon('client')}</th>
                <th className="sortable"><span onClick={() => handleSort('groups')} style={{ cursor: 'pointer', userSelect: 'none' }}>Assigned Group</span> {getSortIcon('groups')}</th>
                <th className="sortable"><span onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>Category</span> {getSortIcon('category')}</th>
                <th className="sortable"><span onClick={() => handleSort('priority')} style={{ cursor: 'pointer', userSelect: 'none' }}>Priority</span> {getSortIcon('priority')}</th>
                <th className="sortable"><span onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>Status</span> {getSortIcon('status')}</th>
                <th className="sortable"><span onClick={() => handleSort('updatedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>Updated</span> {getSortIcon('updatedAt')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map(r => (
                <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row" style={isReadOnly(r) ? { opacity: 0.75 } : {}}>
                  <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                  <td>{r.subject}{isReadOnly(r) && <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>(read-only)</span>}</td>
                  <td>{r.client?.name || '-'}</td>
                  <td>
                    {r.groups && r.groups.length > 0
                      ? r.groups.map((g, i) => (
                          <span key={g.id} className="group-tag" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', marginRight: i < r.groups.length - 1 ? '4px' : 0 }}>
                            {g.name}
                          </span>
                        ))
                      : '-'}
                  </td>
                  <td><span className="category-tag" style={{ background: (r.category?.color || '#3B82F6') + '20', color: r.category?.color || '#3B82F6' }}>{r.category?.name || '-'}</span></td>
                  <td>
                    <span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>
                      {r.priority?.name || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>
                      {r.status?.name || '-'}
                    </span>
                  </td>
                  <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {quickActions(r).map((action, i) => (
                        action.type === 'claim' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            disabled={updatingId === `claim-${r.id}`}
                            onClick={(e) => handleClaim(e, r.id)}
                            style={{ opacity: updatingId === `claim-${r.id}` ? 0.6 : 1 }}
                          >
                            {action.icon} {action.label}
                          </button>
                        ) : action.type === 'delete' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text delete"
                            onClick={() => setDeleteTarget(r.id)}
                          >
                            {action.icon} {action.label}
                          </button>
                        ) : (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            disabled={updatingId === `status-${r.id}`}
                            onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)}
                            style={{ opacity: updatingId === `status-${r.id}` ? 0.6 : 1 }}
                          >
                            {action.icon} {action.label}
                          </button>
                        )
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRequests.length === 0 && (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>
                  {displayRequests.length === 0 ? (showAssignedOnly ? 'No requests assigned to you.' : 'No requests yet.') : 'No requests match your filters.'}
                </td></tr>
              )}
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

      <div className="detail-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, border: 'none', padding: 0 }}>📜 History</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="action-btn-text edit" onClick={() => setShowHistory(!showHistory)}>
              {showHistory ? 'Hide History' : 'Show History'}
            </button>
            <button className="action-btn-text delete" onClick={() => setShowClearConfirm(true)}>
              Clear History
            </button>
          </div>
        </div>
        {showHistory && (
          <div className="timeline">
            {activityLog.length === 0 ? (
              <div className="empty-state">No activity yet</div>
            ) : (
              <div className="timeline-list">
                {activityLog.map((a) => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot" style={{ background: a.user?.role === 'admin' ? '#EF4444' : a.user?.role === 'support' ? '#8B5CF6' : '#3B82F6' }}></div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <strong>{a.user?.name || 'System'}</strong>
                        <span className="timeline-time">{a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</span>
                      </div>
                      <p className="timeline-message">{a.message}</p>
                      {a.request && <small style={{ color: '#6B7280' }}>on: {a.request.subject}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', background: '#1e293b' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>Are you sure you want to clear this history?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setShowClearConfirm(false)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => {
                api.delete('/api/activity').then(() => {
                  setActivityLog([]);
                  showStatusToast('History cleared', 'success');
                  setShowClearConfirm(false);
                }).catch(() => { showStatusToast('Failed to clear history', 'error'); setShowClearConfirm(false); });
              }} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}