import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function ClientDashboard() {
  const [requests, setRequests] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0 });
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [toasts, setToasts] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/requests'),
      api.get('/api/statuses')
    ]).then(([requestsData, statusesData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      const total = requestsData.length;
      const open = requestsData.filter(r => r.status?.name === 'New').length;
      const inProgress = requestsData.filter(r => r.status?.name === 'In Progress' || r.status?.name === 'Assigned').length;
      const resolved = requestsData.filter(r => r.status?.name === 'Resolved' || r.status?.name === 'Closed').length;
      setStats({ total, open, inProgress, resolved });
    }).catch(err => setError('Failed to load data: ' + err.message));
  }, []);

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444', Rejected: '#DC2626' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
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

  const handleEdit = (e, id) => {
    e.stopPropagation();
    navigate(`/client/requests/${id}?edit=true`);
  };

  const handleClientStatusChange = async (e, requestId, statusName) => {
    e.stopPropagation();
    const status = statuses.find(s => s.name === statusName);
    if (!status) return;
    setUpdatingStatus(requestId);
    try {
      await api.put(`/api/requests/${requestId}`, { statusId: status.id });
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status } : r));
      addToast(`Request #${requestId} status changed to ${statusName}`);
      showStatusToast(`Request #${requestId} → ${statusName}`, 'status', requestId);
    } catch (err) {
      addToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdatingStatus(null);
    }
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

  const urlSearch = searchParams.get('search') || '';
  const filteredRequests = requests
    .filter(r => {
      if (!urlSearch) return true;
      const q = urlSearch.toLowerCase();
      return (
        String(r.id).includes(q) ||
        (r.subject || '').toLowerCase().includes(q) ||
        (r.category?.name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!sort.key) return 0;
      let aVal, bVal;
      switch (sort.key) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'subject': aVal = (a.subject || '').toLowerCase(); bVal = (b.subject || '').toLowerCase(); break;
        case 'category': aVal = (a.category?.name || '').toLowerCase(); bVal = (b.category?.name || '').toLowerCase(); break;
        case 'priority': aVal = a.priority?.level || 0; bVal = b.priority?.level || 0; break;
        case 'status': aVal = (a.status?.name || '').toLowerCase(); bVal = (b.status?.name || '').toLowerCase(); break;
        case 'createdAt': aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
        default: return 0;
      }
      if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredRequests.length / perPage);
  const paginatedRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="dashboard">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
      <div className="page-header">
        <div>
          <h1>My Dashboard</h1>
          <p>Welcome back, {user?.name?.split(' ')[0]}! Here are your support requests.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#3B82F615', color: '#3B82F6' }}>📋</div>
          <div className="stat-content">
            <h3>{stats.total}</h3>
            <p>Total Requests</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#10B98115', color: '#10B981' }}>📂</div>
          <div className="stat-content">
            <h3>{stats.open}</h3>
            <p>New</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#F59E0B15', color: '#F59E0B' }}>⏳</div>
          <div className="stat-content">
            <h3>{stats.inProgress}</h3>
            <p>In Progress</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#8B5CF615', color: '#8B5CF6' }}>✅</div>
          <div className="stat-content">
            <h3>{stats.resolved}</h3>
            <p>Resolved</p>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <h3>My Requests ({filteredRequests.length})</h3>
          <div className="table-header-actions">
          </div>
        </div>

        <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable">ID {getSortIcon('id')}</th>
                <th className="sortable">Request Title {getSortIcon('subject')}</th>
                <th className="sortable">Category {getSortIcon('category')}</th>
                <th className="sortable">Priority {getSortIcon('priority')}</th>
                <th className="sortable">Status {getSortIcon('status')}</th>
                <th className="sortable">Created {getSortIcon('createdAt')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.length === 0 && !error && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No requests found</td></tr>
              )}
              {paginatedRequests.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/client/requests/${r.id}`)} className="clickable-row">
                  <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                  <td>{r.subject}</td>
                  <td><span className="category-tag">{r.category?.name || '-'}</span></td>
                  <td><span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>{r.priority?.name || '-'}</span></td>
                  <td><span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>{r.status?.name || '-'}</span></td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {r.status?.name === 'New' && (
                        <>
                          <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>Edit</button>
                          <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>Delete</button>
                        </>
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
