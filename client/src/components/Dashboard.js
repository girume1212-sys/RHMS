import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/dashboard/stats').then(setStats).catch(console.error);
    api.get('/api/activity').then(setRecentActivity).catch(console.error);
    api.get('/api/requests').then(data => setRecentRequests(data.slice(0, 7))).catch(console.error);
  }, []);

  if (!stats) return <div className="loading-screen"><div className="spinner"></div></div>;

  const getChangePercent = (current, last) => {
    if (!last) return { text: '0%', type: 'up' };
    const pct = Math.abs(Math.round(((current - last) / last) * 100));
    return { text: `${pct}%`, type: current >= last ? 'up' : 'down' };
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getActivityIcon = (type) => {
    const icons = { status_update: '🔄', comment: '💬', resolved: '✅', created: '➕', closed: '🔒', assigned: '👤' };
    return icons[type] || '📋';
  };

  const getStatusColor = (status) => {
    const colors = { Open: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Reopened: '#EF4444' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.name?.split(' ')[0]}!</p>
        </div>
        <div className="date-filter">
          <input type="text" className="date-input" value="May 12, 2024 - May 18, 2024" readOnly />
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
        <div className="chart-card">
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

        <div className="chart-card">
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

        <div className="chart-card wide">
          <h3>Requests Overview (This Week)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={280}>
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

      <div className="bottom-row">
        <div className="activity-card">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            {recentActivity.map((a) => (
              <div key={a.id} className="activity-item">
                <div className="activity-icon">{getActivityIcon(a.type)}</div>
                <div className="activity-content">
                  <p>
                    <strong>Request #{a.requestId}</strong> {a.message}
                  </p>
                  <span className="activity-meta">
                    by {a.user?.name || 'Unknown'} · {formatTimeAgo(a.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            <button className="view-all-link" onClick={() => navigate('/activity')}>
              View all activity →
            </button>
          </div>
        </div>

        <div className="requests-table-card">
          <div className="table-header">
            <h3>Latest Requests</h3>
            <div className="table-actions">
              <input type="text" placeholder="Search requests..." className="table-search" />
              <button className="btn btn-outline">Filter</button>
              <button className="btn btn-primary" onClick={() => navigate('/requests/create')}>Create Request</button>
            </div>
          </div>
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
              {recentRequests.map((r) => (
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
          <div className="table-pagination">
            <button className="page-btn">‹</button>
            <button className="page-btn active">1</button>
            <button className="page-btn">2</button>
            <button className="page-btn">3</button>
            <button className="page-btn">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
