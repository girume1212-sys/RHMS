import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { showStatusToast } from '../notify';

export default function EscalationDashboard() {
  const [requests, setRequests] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sort, setSort] = useState({ key: 'updatedAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [updatingField, setUpdatingField] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    Promise.all([
      api.get('/api/requests'),
      api.get('/api/statuses'),
      api.get('/api/users'),
      api.get('/api/priorities')
    ]).then(([requestsData, statusesData, usersData, prioritiesData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      setUsers(usersData);
      setPriorities(prioritiesData);
    }).catch(err => setError('Failed to load data: ' + err.message));
  };

  const developers = users.filter(u => u.role === 'developer');

  const stats = {
    total: requests.length,
    open: requests.filter(r => r.status?.name === 'New').length,
    assigned: requests.filter(r => r.status?.name === 'Assigned').length,
    inProgress: requests.filter(r => r.status?.name === 'In Progress').length,
    waiting: requests.filter(r => r.status?.name === 'Waiting for Client').length,
    resolved: requests.filter(r => r.status?.name === 'Resolved').length,
    closed: requests.filter(r => r.status?.name === 'Closed').length,
    reopened: requests.filter(r => r.status?.name === 'Reopened').length,
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981' };
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
    setUpdatingField(`status-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { statusId: status.id });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: status } : r));
      showStatusToast(`Request #${requestId} → ${statusName}`, 'status', requestId);
    } catch (err) {
      showStatusToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleAssign = async (e, requestId, developerId) => {
    e.stopPropagation();
    setShowAssignModal(null);
    setUpdatingField(`assign-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { assignedTo: developerId || null });
      const dev = users.find(u => u.id === developerId);
      const newStatus = developerId ? statuses.find(s => s.name === 'Assigned') : statuses.find(s => s.name === 'New');
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assignedTo: developerId, assignee: dev || null, status: newStatus || r.status } : r));
      showStatusToast(`Request #${requestId} assigned to ${dev?.name || 'Unassigned'}`, 'assignment', requestId);
    } catch (err) {
      showStatusToast('Failed to assign: ' + err.message, 'error');
    } finally {
      setUpdatingField(null);
    }
  };

  const handlePriorityChange = async (e, requestId, priorityId) => {
    e.stopPropagation();
    setUpdatingField(`priority-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { priorityId });
      const pri = priorities.find(p => p.id === priorityId);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, priorityId, priority: pri || r.priority } : r));
      showStatusToast(`Request #${requestId} priority → ${pri?.name}`, 'status', requestId);
    } catch (err) {
      showStatusToast('Failed to update priority: ' + err.message, 'error');
    } finally {
      setUpdatingField(null);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await api.delete(`/api/requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast('Request deleted successfully', 'success');
    } catch (err) {
      showStatusToast('Failed to delete request: ' + err.message, 'error');
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

  const filteredRequests = requests
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
          (r.assignee?.name || '').toLowerCase().includes(q)
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
        case 'assignee': aVal = (a.assignee?.name || '').toLowerCase(); bVal = (b.assignee?.name || '').toLowerCase(); break;
        case 'updatedAt': aVal = new Date(a.updatedAt || 0); bVal = new Date(b.updatedAt || 0); break;
        case 'createdAt': aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredRequests.length / perPage);
  const paginatedRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

  const getQuickActions = (r) => {
    const statusName = r.status?.name;
    const actions = [];

    if (statusName === 'New') {
      actions.push({ label: 'Assign', status: 'Assigned', color: '#8B5CF6', icon: '👤', type: 'assign' });
    }
    if (statusName === 'Waiting for Client') {
      actions.push({ label: 'Follow Up', status: 'In Progress', color: '#F59E0B', icon: '📞', type: 'status' });
    }
    if (statusName === 'In Progress') {
      actions.push({ label: 'Request Update', status: 'Waiting for Client', color: '#F97316', icon: '❓', type: 'status' });
    }
    return actions;
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Escalation Team Dashboard</h1>
          <p>Welcome back, {user?.name?.split(' ')[0]}! Manage incoming requests and coordinate the team.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
          {error}
          <button onClick={() => { setError(''); loadData(); }} style={{ marginLeft: '12px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => { setStatusFilter(''); setPriorityFilter(''); }}>
          <div className="stat-icon" style={{ background: '#3B82F615', color: '#3B82F6' }}>📋</div>
          <div className="stat-content">
            <h3>{stats.total}</h3>
            <p>Total</p>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: stats.open > 0 ? '3px solid #3B82F6' : 'none' }} onClick={() => setStatusFilter(statusFilter === 'New' ? '' : 'New')}>
          <div className="stat-icon" style={{ background: '#3B82F615', color: '#3B82F6' }}>📥</div>
          <div className="stat-content">
            <h3>{stats.open}</h3>
            <p>New</p>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: stats.assigned > 0 ? '3px solid #8B5CF6' : 'none' }} onClick={() => setStatusFilter(statusFilter === 'Assigned' ? '' : 'Assigned')}>
          <div className="stat-icon" style={{ background: '#8B5CF615', color: '#8B5CF6' }}>👤</div>
          <div className="stat-content">
            <h3>{stats.assigned + stats.inProgress}</h3>
            <p>Assigned</p>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: stats.waiting > 0 ? '3px solid #F97316' : 'none' }} onClick={() => setStatusFilter(statusFilter === 'Waiting for Client' ? '' : 'Waiting for Client')}>
          <div className="stat-icon" style={{ background: '#F9731615', color: '#F97316' }}>⏳</div>
          <div className="stat-content">
            <h3>{stats.waiting}</h3>
            <p>Awaiting</p>
          </div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer', borderLeft: stats.resolved > 0 ? '3px solid #10B981' : 'none' }} onClick={() => setStatusFilter(statusFilter === 'Resolved' ? '' : 'Resolved')}>
          <div className="stat-icon" style={{ background: '#10B98115', color: '#10B981' }}>✅</div>
          <div className="stat-content">
            <h3>{stats.resolved}</h3>
            <p>To Verify</p>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <h3>All Requests ({filteredRequests.length})</h3>
          <div className="table-header-actions">
            <select className="filter-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {statuses.filter(s => s.name !== 'Closed' && s.name !== 'Reopened').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="filter-select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">All Priorities</option>
              {priorities.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
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
                <th className="sortable">ID {getSortIcon('id')}</th>
                <th className="sortable">Request Title {getSortIcon('subject')}</th>
                <th className="sortable">Client {getSortIcon('client')}</th>
                <th className="sortable">Category {getSortIcon('category')}</th>
                <th className="sortable">Priority {getSortIcon('priority')}</th>
                <th className="sortable">Status {getSortIcon('status')}</th>
                <th className="sortable">Assigned To {getSortIcon('assignee')}</th>
                <th className="sortable">Updated {getSortIcon('updatedAt')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map(r => (
                <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                  <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subject}</td>
                  <td>{r.client?.name || '-'}</td>
                  <td><span className="category-tag">{r.category?.name || '-'}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select
                      value={r.priorityId || ''}
                      onChange={(e) => handlePriorityChange(e, r.id, e.target.value)}
                      disabled={updatingField === `priority-${r.id}`}
                      style={{
                        padding: '3px 6px',
                        borderRadius: '4px',
                        border: `1px solid ${getPriorityColor(r.priority)}40`,
                        background: getPriorityColor(r.priority) + '15',
                        color: getPriorityColor(r.priority),
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {priorities.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>
                      {r.status?.name || '-'}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setShowAssignModal(showAssignModal === r.id ? null : r.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          fontSize: '12px',
                          cursor: 'pointer',
                          background: r.assignee ? '#EEF2FF' : '#FEF3C7',
                          color: r.assignee ? '#4F46E5' : '#D97706',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {r.assignee?.name || 'Unassigned'}
                      </button>
                      {showAssignModal === r.id && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          zIndex: 100,
                          background: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          padding: '8px',
                          minWidth: '180px'
                        }}>
                          <button
                            onClick={(e) => handleAssign(e, r.id, null)}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', borderRadius: '4px' }}
                            onMouseOver={(e) => e.target.style.background = '#f3f4f6'}
                            onMouseOut={(e) => e.target.style.background = 'none'}
                          >
                            Unassign
                          </button>
                          {developers.map(dev => (
                            <button
                              key={dev.id}
                              onClick={(e) => handleAssign(e, r.id, dev.id)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', background: r.assignedTo === dev.id ? '#EEF2FF' : 'none', cursor: 'pointer', fontSize: '12px', borderRadius: '4px', color: r.assignedTo === dev.id ? '#4F46E5' : '#374151' }}
                              onMouseOver={(e) => e.target.style.background = '#f3f4f6'}
                              onMouseOut={(e) => e.target.style.background = r.assignedTo === dev.id ? '#EEF2FF' : 'none'}
                            >
                              {dev.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {getQuickActions(r).map((action, i) => (
                        action.type === 'assign' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            onClick={() => setShowAssignModal(showAssignModal === r.id ? null : r.id)}
                          >
                            {action.icon} {action.label}
                          </button>
                        ) : (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            disabled={updatingField === `status-${r.id}`}
                            onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)}
                            style={{ opacity: updatingField === `status-${r.id}` ? 0.6 : 1 }}
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
                  {requests.length === 0 ? 'No requests in the system.' : 'No requests match your filters.'}
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
    </div>
  );
}
