import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { showStatusToast } from '../notify';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#F97316', '#10B981', '#6B7280', '#EF4444'];

function StatCard({ icon, value, label, change, changeType, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: color + '15', color }}>{icon}</div>
      <div className="stat-content">
        <h3>{value}</h3>
        <p>{label}</p>
        <span className={`stat-change ${changeType}`}>
          {changeType === 'up' ? '↑' : '↓'} {change} from last week
        </span>
      </div>
    </div>
  );
}

const PERF_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [perfData, setPerfData] = useState(null);
  const [perfView, setPerfView] = useState('company');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/dashboard/stats').then(setStats).catch(err => setError('Failed to load dashboard stats: ' + err.message));
    api.get('/api/requests').then(data => {
      let filtered = data;
      if (user?.role === 'developer' || user?.role === 'support') {
        filtered = data.filter(r => r.assignedTo === user.id);
      }
      setRecentRequests(filtered);
    }).catch(err => setError('Failed to load requests: ' + err.message));
    api.get('/api/dashboard/performance?days=30').then(setPerfData).catch(() => {});
  }, [user]);

  if (!stats && !error) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (error && !stats) return (
    <div className="dashboard">
      <div className="page-header"><div><h1>{user?.role === 'developer' ? 'My Tasks' : user?.role === 'support' ? 'My Tasks' : 'Dashboard'}</h1><p>Welcome back, {user?.name?.split(' ')[0]}!</p></div></div>
      <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>
    </div>
  );

  const getChangePercent = (current, last) => {
    if (!last) return { text: '0%', type: 'up' };
    const pct = Math.abs(Math.round(((current - last) / last) * 100));
    return { text: `${pct}%`, type: current >= last ? 'up' : 'down' };
  };

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
      setRecentRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast('Request deleted successfully', 'success');
    } catch (err) {
      showStatusToast('Failed to delete request', 'error');
    }
  };

  const handleSort = (key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    const isActive = sort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const filteredRequests = recentRequests
    .filter(r => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(r.id).includes(q) ||
        (r.subject || '').toLowerCase().includes(q) ||
        (r.clientName || r.client_name || '').toLowerCase().includes(q) ||
        (r.categoryName || r.category_name || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (!sort.key) return 0;
      let aVal, bVal;
      switch (sort.key) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'subject': aVal = (a.subject || '').toLowerCase(); bVal = (b.subject || '').toLowerCase(); break;
        case 'client': aVal = (a.clientName || a.client_name || '').toLowerCase(); bVal = (b.clientName || b.client_name || '').toLowerCase(); break;
        case 'category': aVal = (a.categoryName || a.category_name || '').toLowerCase(); bVal = (b.categoryName || b.category_name || '').toLowerCase(); break;
        case 'priority': aVal = (a.priorityName || a.priority?.name || '').toLowerCase(); bVal = (b.priorityName || b.priority?.name || '').toLowerCase(); break;
        case 'status': aVal = (a.statusName || a.status?.name || '').toLowerCase(); bVal = (b.statusName || b.status?.name || '').toLowerCase(); break;
        case 'assignedTo': aVal = (a.assignedToName || a.assigned_to_name || '').toLowerCase(); bVal = (b.assignedToName || b.assigned_to_name || '').toLowerCase(); break;
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
      <div className="page-header">
        <div>
          <h1>{user?.role === 'developer' || user?.role === 'support' ? 'My Tasks' : 'Dashboard'}</h1>
          <p>Welcome back, {user?.name?.split(' ')[0]}!</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="📋" value={stats.total} label="Total Requests" change={getChangePercent(stats.total, stats.totalLastWeek).text} changeType={getChangePercent(stats.total, stats.totalLastWeek).type} color="#3B82F6" />
        <StatCard icon="📂" value={stats.open} label="Open Requests" change={getChangePercent(stats.open, stats.openLastWeek).text} changeType={getChangePercent(stats.open, stats.openLastWeek).type} color="#10B981" />
        <StatCard icon="⏳" value={stats.inProgress} label="In Progress" change={getChangePercent(stats.inProgress, stats.inProgressLastWeek).text} changeType={getChangePercent(stats.inProgress, stats.inProgressLastWeek).type} color="#F59E0B" />
        <StatCard icon="✅" value={stats.resolved} label="Resolved" change={getChangePercent(stats.resolved, stats.resolvedLastWeek).text} changeType={getChangePercent(stats.resolved, stats.resolvedLastWeek).type} color="#8B5CF6" />
        <StatCard icon="📁" value={stats.closed} label="Closed" change={getChangePercent(stats.closed, stats.closedLastWeek).text} changeType={getChangePercent(stats.closed, stats.closedLastWeek).type} color="#EF4444" />
      </div>

      <div className="charts-row">
        <div className="chart-card" style={{ flex: 1 }}>
          <h3>Requests by Status</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stats.byStatus.filter(s => s.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {stats.byStatus.filter(s => s.count > 0).map((entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {stats.byStatus.filter(s => s.count > 0).map((s, i) => (
                <div key={s.id} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                  <span className="legend-label">{s.name}</span>
                  <span className="legend-value">{s.count} ({s.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ flex: 1 }}>
          <h3>Requests by Priority</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={stats.byPriority.filter(p => p.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {stats.byPriority.filter(p => p.count > 0).map((entry, i) => (
                    <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              {stats.byPriority.filter(p => p.count > 0).map((p, i) => (
                <div key={p.id} className="legend-item">
                  <span className="legend-dot" style={{ background: p.color || COLORS[i % COLORS.length] }}></span>
                  <span className="legend-label">{p.name}</span>
                  <span className="legend-value">{p.count} ({p.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ flex: 1 }}>
          <h3>Requests Overview (This Week)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="created" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="closed" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <h3>Latest Requests</h3>
          <div className="table-header-actions">
            <div className="table-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
        <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable">ID {getSortIcon('id')}</th>
                <th className="sortable">Subject {getSortIcon('subject')}</th>
                <th className="sortable">Client {getSortIcon('client')}</th>
                <th className="sortable">Category {getSortIcon('category')}</th>
                <th className="sortable">Priority {getSortIcon('priority')}</th>
                <th className="sortable">Status {getSortIcon('status')}</th>
                <th className="sortable">Assigned To {getSortIcon('assignedTo')}</th>
                <th className="sortable">Created {getSortIcon('createdAt')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map(r => (
                <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                  <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                  <td>{r.subject}</td>
                  <td>{r.clientName || r.client_name || '-'}</td>
                  <td>{r.categoryName || r.category_name || '-'}</td>
                  <td>
                    <span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>
                      {r.priorityName || r.priority?.name || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>
                      {r.statusName || r.status?.name || '-'}
                    </span>
                  </td>
                  <td>
                    {(r.assignedToName || r.assigned_to_name) ? (
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: '#3B82F6' }}>
                          {(r.assignedToName || r.assigned_to_name || '').charAt(0)}
                        </div>
                        <span>{r.assignedToName || r.assigned_to_name}</span>
                      </div>
                    ) : <span style={{ color: '#9ca3af' }}>-</span>}
                  </td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      <button className="action-btn-text edit" onClick={() => navigate(`/requests/${r.id}?edit=true`)}>Edit</button>
                      <button className="action-btn-text delete" onClick={(e) => handleDelete(e, r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRequests.length === 0 && (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No requests found</td></tr>
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

      {perfData && (
        <div className="performance-section">
          <div className="perf-toggle-container">
            <button
              className={`perf-toggle-btn ${perfView === 'company' ? 'active' : ''}`}
              onClick={() => setPerfView('company')}
            >
              <span className="perf-toggle-icon">🏢</span>
              Company Performance
            </button>
            <button
              className={`perf-toggle-btn ${perfView === 'developer' ? 'active' : ''}`}
              onClick={() => setPerfView('developer')}
            >
              <span className="perf-toggle-icon">👨‍💻</span>
              Developer Performance
            </button>
          </div>

          {perfView === 'company' && (
            <div className="charts-row">
              <div className="chart-card wide">
                <div className="perf-header">
                  <h3>Company Performance (Last 30 Days)</h3>
                </div>
                <div className="perf-charts-grid">
                  <div className="perf-chart-section">
                    <h4>Created Requests</h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={perfData.labels.map((label, i) => {
                        const entry = { date: label };
                        perfData.byCompany.forEach(s => {
                          entry[s.name] = s.data[i]?.created || 0;
                        });
                        return entry;
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        {perfData.byCompany.map((s, i) => (
                          <Line key={s.name} type="monotone" dataKey={s.name} stroke={PERF_COLORS[i % PERF_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="perf-chart-section">
                    <h4>Resolved Requests</h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={perfData.labels.map((label, i) => {
                        const entry = { date: label };
                        perfData.byCompany.forEach(s => {
                          entry[s.name] = s.data[i]?.resolved || 0;
                        });
                        return entry;
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        {perfData.byCompany.map((s, i) => (
                          <Line key={s.name} type="monotone" dataKey={s.name} stroke={PERF_COLORS[i % PERF_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {perfView === 'developer' && (
            <div className="charts-row">
              <div className="chart-card wide">
                <div className="perf-header">
                  <h3>Developer Performance (Last 30 Days)</h3>
                </div>
                <div className="perf-charts-grid">
                  <div className="perf-chart-section">
                    <h4>Created Requests</h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={perfData.labels.map((label, i) => {
                        const entry = { date: label };
                        perfData.byDeveloper.forEach(s => {
                          entry[s.name] = s.data[i]?.created || 0;
                        });
                        return entry;
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        {perfData.byDeveloper.map((s, i) => (
                          <Line key={s.name} type="monotone" dataKey={s.name} stroke={PERF_COLORS[i % PERF_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="perf-chart-section">
                    <h4>Resolved Requests</h4>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={perfData.labels.map((label, i) => {
                        const entry = { date: label };
                        perfData.byDeveloper.forEach(s => {
                          entry[s.name] = s.data[i]?.resolved || 0;
                        });
                        return entry;
                      })}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Legend />
                        {perfData.byDeveloper.map((s, i) => (
                          <Line key={s.name} type="monotone" dataKey={s.name} stroke={PERF_COLORS[i % PERF_COLORS.length]} strokeWidth={2} dot={false} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
