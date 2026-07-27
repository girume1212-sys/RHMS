import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { showStatusToast } from '../notify';

export default function Reports() {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(10);
  const [perfPage, setPerfPage] = useState(1);
  const [perfPerPage, setPerfPerPage] = useState(10);
  const [tasksSort, setTasksSort] = useState({ key: '', dir: 'asc' });
  const [perfSort, setPerfSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    api.get('/api/reports/summary').then(setReport);
  }, []);

  if (!report) return <div className="loading-screen"><div className="spinner"></div></div>;

  const handleTasksSort = (key) => {
    setTasksSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setTasksPage(1);
  };

  const getTasksSortIcon = (key) => {
    const isActive = tasksSort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleTasksSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleTasksSort(key); }}>{tasksSort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const getTasksSortValue = (r, key) => {
    switch (key) {
      case 'id': return r.id;
      case 'subject': return (r.subject || '').toLowerCase();
      case 'client': return (r.client_name || '').toLowerCase();
      case 'category': return (r.category_name || '').toLowerCase();
      case 'priority': return (r.priority_name || '').toLowerCase();
      case 'created': return new Date(r.created_at).getTime();
      default: return '';
    }
  };

  const sortedTasks = [...(report.newTasks || [])].sort((a, b) => {
    if (!tasksSort.key) return 0;
    const aVal = getTasksSortValue(a, tasksSort.key);
    const bVal = getTasksSortValue(b, tasksSort.key);
    if (aVal < bVal) return tasksSort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return tasksSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const tasksTotalPages = Math.ceil(sortedTasks.length / tasksPerPage);
  const paginatedTasks = sortedTasks.slice((tasksPage - 1) * tasksPerPage, tasksPage * tasksPerPage);

  const handlePerfSort = (key) => {
    setPerfSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPerfPage(1);
  };

  const getPerfSortIcon = (key) => {
    const isActive = perfSort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handlePerfSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handlePerfSort(key); }}>{perfSort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const getPerfSortValue = (u, key) => {
    switch (key) {
      case 'name': return (u.name || '').toLowerCase();
      case 'role': return (u.role || '').toLowerCase();
      case 'total': return u.total_assigned || 0;
      case 'resolved': return u.resolved || 0;
      case 'inProgress': return u.in_progress || 0;
      case 'pending': return u.pending || 0;
      case 'rate': return u.total_assigned > 0 ? (u.resolved / u.total_assigned) : 0;
      default: return '';
    }
  };

  const sortedPerf = [...(report.userPerformance || [])].sort((a, b) => {
    if (!perfSort.key) return 0;
    const aVal = getPerfSortValue(a, perfSort.key);
    const bVal = getPerfSortValue(b, perfSort.key);
    if (aVal < bVal) return perfSort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return perfSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const perfTotalPages = Math.ceil(sortedPerf.length / perfPerPage);
  const paginatedPerf = sortedPerf.slice((perfPage - 1) * perfPerPage, perfPage * perfPerPage);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/requests/${id}`);
      setReport(prev => ({
        ...prev,
        newTasks: prev.newTasks.filter(r => r.id !== id)
      }));
      showStatusToast(`Request #${id} deleted`, 'request_deleted', id);
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast('Failed to delete request', 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Reports & Analytics</h1>
          <p>System performance and analytics overview</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card-simple"><h3>{report.total}</h3><p>Total Requests</p></div>
        <div className="stat-card-simple"><h3>{report.totalUsers}</h3><p>Total Users</p></div>
        <div className="stat-card-simple"><h3>{report.avgResolutionTime}</h3><p>Avg Resolution Time</p></div>
        <div className="stat-card-simple"><h3>{report.clientSatisfaction}</h3><p>Client Satisfaction</p></div>
      </div>

      <div className="charts-row">
        <div className="chart-card">
          <h3>Requests by Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byStatus || []).map(s => ({ ...s, count: Number(s.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Requests by Priority</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byPriority || []).map(p => ({ ...p, count: Number(p.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Requests by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byCategory || []).map(c => ({ ...c, count: Number(c.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Requests by Company</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byCompany || []).map(c => ({ ...c, count: Number(c.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#06B6D4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card wide">
          <h3>New Tasks (Latest 10)</h3>
          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">ID {getTasksSortIcon('id')}</th>
                  <th className="sortable">Request Title {getTasksSortIcon('subject')}</th>
                  <th className="sortable">Client {getTasksSortIcon('client')}</th>
                  <th className="sortable">Category {getTasksSortIcon('category')}</th>
                  <th className="sortable">Priority {getTasksSortIcon('priority')}</th>
                  <th className="sortable">Created {getTasksSortIcon('created')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTasks.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                    <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                    <td>{r.subject}</td>
                    <td>{r.client_name || '-'}</td>
                    <td><span className="category-tag">{r.category_name || '-'}</span></td>
                    <td><span className="priority-badge">{r.priority_name || '-'}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {r.status_name === 'New' ? (
                        <>
                          <button className="action-btn-text edit" onClick={() => navigate(`/requests/${r.id}?edit=true`)}>Edit</button>
                          <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>Delete</button>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>—</span>
                      )}
                    </div>
                    </td>
                  </tr>
                ))}
                {paginatedTasks.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No tasks found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <div className="table-footer-info">
              <span>Show</span>
              <select value={tasksPerPage} onChange={(e) => { setTasksPerPage(Number(e.target.value)); setTasksPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>of {sortedTasks.length} tasks</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={tasksPage === 1} onClick={() => setTasksPage(1)}>«</button>
              <button className="page-btn" disabled={tasksPage === 1} onClick={() => setTasksPage(tasksPage - 1)}>‹</button>
              {Array.from({ length: tasksTotalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${tasksPage === p ? 'active' : ''}`} onClick={() => setTasksPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={tasksPage === tasksTotalPages || tasksTotalPages === 0} onClick={() => setTasksPage(tasksPage + 1)}>›</button>
              <button className="page-btn" disabled={tasksPage === tasksTotalPages || tasksTotalPages === 0} onClick={() => setTasksPage(tasksTotalPages)}>»</button>
            </div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card wide">
          <h3>User Performance</h3>
          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">User {getPerfSortIcon('name')}</th>
                  <th className="sortable">Role {getPerfSortIcon('role')}</th>
                  <th className="sortable">Total Assigned {getPerfSortIcon('total')}</th>
                  <th className="sortable">Resolved {getPerfSortIcon('resolved')}</th>
                  <th className="sortable">In Progress {getPerfSortIcon('inProgress')}</th>
                  <th className="sortable">Pending {getPerfSortIcon('pending')}</th>
                  <th className="sortable">Resolution Rate {getPerfSortIcon('rate')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPerf.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: u.role === 'developer' ? '#8B5CF6' : '#3B82F6' }}>{u.name.charAt(0)}</div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td><span className="role-badge" style={{ background: u.role === 'developer' ? '#8B5CF620' : '#3B82F620', color: u.role === 'developer' ? '#8B5CF6' : '#3B82F6' }}>{u.role === 'developer' ? 'Developer' : 'Escalation Team'}</span></td>
                    <td>{u.total_assigned}</td>
                    <td style={{ color: '#10B981' }}>{u.resolved}</td>
                    <td style={{ color: '#F59E0B' }}>{u.in_progress}</td>
                    <td style={{ color: '#EF4444' }}>{u.pending}</td>
                    <td>{u.total_assigned > 0 ? Math.round((u.resolved / u.total_assigned) * 100) : 0}%</td>
                  </tr>
                ))}
                {paginatedPerf.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No performance data</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <div className="table-footer-info">
              <span>Show</span>
              <select value={perfPerPage} onChange={(e) => { setPerfPerPage(Number(e.target.value)); setPerfPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>of {sortedPerf.length} users</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={perfPage === 1} onClick={() => setPerfPage(1)}>«</button>
              <button className="page-btn" disabled={perfPage === 1} onClick={() => setPerfPage(perfPage - 1)}>‹</button>
              {Array.from({ length: perfTotalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${perfPage === p ? 'active' : ''}`} onClick={() => setPerfPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={perfPage === perfTotalPages || perfTotalPages === 0} onClick={() => setPerfPage(perfPage + 1)}>›</button>
              <button className="page-btn" disabled={perfPage === perfTotalPages || perfTotalPages === 0} onClick={() => setPerfPage(perfTotalPages)}>»</button>
            </div>
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
