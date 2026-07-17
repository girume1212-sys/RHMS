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
    status: '',
    priority: '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || ''
  });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [toasts, setToasts] = useState([]);
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
    setError('');
    api.get(`/api/requests?${params}`).then(data => {
      let filtered = data;
      if (user?.role === 'developer' || user?.role === 'support') {
        filtered = data.filter(r => r.assignedTo === user.id);
      }
      setRequests(filtered);
      setLoading(false);
    }).catch(err => {
      setError('Failed to load requests: ' + err.message);
      setLoading(false);
    });
  }, [filter, user]);

  const getStatusColor = (status) => {
    const colors = { Open: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await api.delete(`/api/requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      addToast('Request deleted successfully!');
      showStatusToast(`Request #${id} deleted`, 'request_deleted', id);
    } catch (err) {
      setError('Failed to delete request: ' + err.message);
      addToast('Failed to delete request: ' + err.message, 'error');
    }
  };

  const handleEdit = (e, id) => {
    e.stopPropagation();
    navigate(`${basePath}/requests/${id}?edit=true`);
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
          (r.category?.name || '').toLowerCase().includes(q)
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
          <option value="1">Open</option>
          <option value="2">Assigned</option>
          <option value="3">In Progress</option>
          <option value="4">Waiting for Client</option>
          <option value="5">Resolved</option>
          <option value="6">Closed</option>
          <option value="7">Reopened</option>
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
            <h3>Requests ({filteredRequests.length})</h3>
            <div className="table-header-actions">
              <div className="table-search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search requests..." value={filter.search} onChange={(e) => { setFilter({ ...filter, search: e.target.value }); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">ID {getSortIcon('id')}</th>
                  <th className="sortable">Subject {getSortIcon('subject')}</th>
                  {!isClient && <th className="sortable">Client {getSortIcon('client')}</th>}
                  <th className="sortable">Category {getSortIcon('category')}</th>
                  <th className="sortable">Priority {getSortIcon('priority')}</th>
                  <th className="sortable">Status {getSortIcon('status')}</th>
                  {!isClient && <th className="sortable">Assigned To {getSortIcon('assignee')}</th>}
                  <th className="sortable">Created {getSortIcon('createdAt')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr><td colSpan={isClient ? 7 : 8} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No requests found</td></tr>
                )}
                {paginated.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`${basePath}/requests/${r.id}`)} className="clickable-row">
                    <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                    <td>{r.subject}</td>
                    {!isClient && <td>{r.client?.name || '-'}</td>}
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
                        <button className="action-btn-text edit" onClick={(e) => handleEdit(e, r.id)}>Edit</button>
                        <button className="action-btn-text delete" onClick={(e) => handleDelete(e, r.id)}>Delete</button>
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
    </div>
  );
}
