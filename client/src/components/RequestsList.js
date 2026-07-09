import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function RequestsList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', priority: '', category: '', search: '' });
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.priority) params.set('priority', filter.priority);
    if (filter.category) params.set('category', filter.category);
    if (filter.search) params.set('search', filter.search);
    api.get(`/api/requests?${params}`).then(data => {
      setRequests(data);
      setLoading(false);
    });
  }, [filter]);

  const getStatusColor = (status) => {
    const colors = { Open: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const perPage = 10;
  const totalPages = Math.ceil(requests.length / perPage);
  const paginated = requests.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Requests</h1>
          <p>Manage all support requests</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/requests/create')}>
          + Create Request
        </button>
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
          <option value="1">Payroll</option>
          <option value="2">Attendance</option>
          <option value="3">Leave Management</option>
          <option value="4">Employee Management</option>
          <option value="5">System</option>
          <option value="6">Reports</option>
          <option value="7">Integration</option>
          <option value="8">Other</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Client</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                    <td className="req-id">{r.id}</td>
                    <td className="req-subject">{r.subject}</td>
                    <td>{r.client?.name || '-'}</td>
                    <td><span className="category-tag">{r.category?.name || '-'}</span></td>
                    <td><span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>{r.priority?.name || '-'}</span></td>
                    <td><span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>{r.status?.name || '-'}</span></td>
                    <td>{r.assignee ? (
                      <div className="assignee-cell">
                        <div className="assignee-avatar" style={{ background: '#3B82F6' }}>{r.assignee.name.charAt(0)}</div>
                        {r.assignee.name.split(' ')[0]}
                      </div>
                    ) : '-'}</td>
                    <td>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td><button className="actions-btn">⋮</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {paginated.length === 0 && <div className="empty-state">No requests found</div>}
          </div>
          {totalPages > 1 && (
            <div className="table-pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} className={`page-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
