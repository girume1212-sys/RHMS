import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api, API_BASE } from '../api';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';
import RequestCalendar from './RequestCalendar';
import PageNumbers from './PageNumbers';
import Icon from './Icon';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#F97316', '#10B981', '#6B7280', '#EF4444'];

const STATUS_CONFIG = [
  { key: 'New', color: '#3B82F6' },
  { key: 'Assigned', color: '#8B5CF6' },
  { key: 'In Progress', color: '#F59E0B' },
  { key: 'Waiting for Client', color: '#F97316' },
  { key: 'Resolved', color: '#10B981' },
  { key: 'Closed', color: '#6B7280' },
  { key: 'Escalated', color: '#EF4444' },
];

function StatCard({ icon, value, label, change, changeType, color, onClick, changeLabel }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="stat-card"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transform: hover ? 'translateY(-4px)' : '',
        boxShadow: hover ? `0 8px 25px ${color}30` : '',
        borderLeft: hover ? `4px solid ${color}` : '4px solid transparent',
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s'
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <div className="stat-icon" style={{ background: color + '15', color }}>{icon}</div>
      <div className="stat-content">
        <h3>{value}</h3>
        <p>{label}</p>
        <span className={`stat-change ${changeType}`}>
          {'↑'} {change} {changeLabel}
        </span>
      </div>
    </div>
  );
}

const PERF_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [perfData, setPerfData] = useState(null);
  const [perfView, setPerfView] = useState('company');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const changeLabel = t('common.fromLastWeek');

  useEffect(() => {
    api.get('/api/dashboard/stats').then(setStats).catch(err => setError(t('common.failedToLoadDashboard') + ' ' + err.message));
    api.get('/api/requests').then(data => {
      let filtered = data;
      if (user?.role === 'developer' || user?.role === 'support') {
        filtered = data.filter(r => r.assignedTo === user.id || !r.assignedTo);
      }
      setRecentRequests(filtered);
    }).catch(err => setError(t('common.failedToLoadRequests') + ' ' + err.message));
    api.get('/api/dashboard/performance?days=30').then(setPerfData).catch(err => console.error('Perf fetch error:', err));
  }, [user]);

  if (!stats && !error) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (error && !stats) return (
    <div className="dashboard">
      <div className="page-header"><div><h1>{user?.role === 'developer' || user?.role === 'support' ? t('common.myTasks') : t('common.dashboard')}</h1><p>{t('common.welcomeBack', { name: user?.name?.split(' ')[0] })}</p></div><div style={{ display: 'flex', alignItems: 'flex-start' }}><RequestCalendar /></div></div>
      <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>
    </div>
  );

  const getChangePercent = (current, last) => {
    if (!last) return { text: '0%', type: 'up' };
    const pct = Math.abs(Math.round(((current - last) / last) * 100));
    return { text: `${pct}%`, type: current >= last ? 'up' : 'down' };
  };

  const getStatusColor = (status) => {
    const colors = { New: '#3B82F6', Assigned: '#8B5CF6', 'In Progress': '#F59E0B', 'Waiting for Client': '#F97316', Resolved: '#10B981', Closed: '#6B7280', Rejected: '#DC2626' };
    return colors[status?.name] || '#6B7280';
  };

  const getPriorityColor = (priority) => {
    const colors = { Low: '#3B82F6', Medium: '#F59E0B', High: '#EF4444', Critical: '#DC2626' };
    return colors[priority?.name] || '#6B7280';
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/requests/${id}`);
      setRecentRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast(t('common.requestDeleted'), 'success');
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast(t('common.failedToDeleteRequest'), 'error');
      setDeleteTarget(null);
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
      const str = (v) => (v === undefined || v === null) ? '' : String(v).toLowerCase();
      return [
        str(r.id),
        str(r.subject),
        str(r.description),
        str(r.statusName || r.status?.name),
        str(r.priorityName || r.priority?.name),
        str(r.categoryName || r.category_name || r.category?.name),
        str(r.clientName || r.client_name || r.client?.name),
        str(r.assignee?.name),
        str(r.assignedGroup?.name),
        ...(r.groups || []).map(g => str(g.name)),
        r.createdAt ? str(new Date(r.createdAt).toLocaleString()) : '',
        r.updatedAt ? str(new Date(r.updatedAt).toLocaleString()) : ''
      ].some(s => s.includes(q));
    })
    .sort((a, b) => {
      if (!sort.key) return 0;
      let aVal, bVal;
      switch (sort.key) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'subject': aVal = (a.subject || '').toLowerCase(); bVal = (b.subject || '').toLowerCase(); break;
        case 'client': aVal = (a.clientName || a.client_name || '').toLowerCase(); bVal = (b.clientName || b.client_name || '').toLowerCase(); break;
        case 'groups': aVal = (a.groups?.[0]?.name || '').toLowerCase(); bVal = (b.groups?.[0]?.name || '').toLowerCase(); break;
        case 'assignedGroup': aVal = (a.assignedGroup?.name || '').toLowerCase(); bVal = (b.assignedGroup?.name || '').toLowerCase(); break;
        case 'category': aVal = (a.category?.name || a.categoryName || a.category_name || '').toLowerCase(); bVal = (b.category?.name || b.categoryName || b.category_name || '').toLowerCase(); break;
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
          <h1>{user?.role === 'developer' || user?.role === 'support' ? t('common.myTasks') : t('common.dashboard')}</h1>
          <p>{t('common.welcomeBack', { name: user?.name?.split(' ')[0] })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <RequestCalendar />
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={<Icon name="total" />} value={stats.total} label={t('common.totalRequests')} change={getChangePercent(stats.total, stats.totalLastWeek).text} changeType={getChangePercent(stats.total, stats.totalLastWeek).type} changeLabel={changeLabel} color="#3B82F6" onClick={() => navigate('/requests')} />
        <StatCard icon={<Icon name="new" />} value={stats.open} label={t('common.newRequests')} change={getChangePercent(stats.open, stats.openLastWeek).text} changeType={getChangePercent(stats.open, stats.openLastWeek).type} changeLabel={changeLabel} color="#10B981" onClick={() => navigate('/requests?status=1')} />
        <StatCard icon={<Icon name="inProgress" />} value={stats.inProgress} label={t('common.inProgress')} change={getChangePercent(stats.inProgress, stats.inProgressLastWeek).text} changeType={getChangePercent(stats.inProgress, stats.inProgressLastWeek).type} changeLabel={changeLabel} color="#F59E0B" onClick={() => navigate('/requests?status=3')} />
        <StatCard icon={<Icon name="waiting" />} value={stats.waiting} label={t('common.waitingForClient')} change={getChangePercent(stats.waiting, stats.waitingLastWeek).text} changeType={getChangePercent(stats.waiting, stats.waitingLastWeek).type} changeLabel={changeLabel} color="#F97316" onClick={() => navigate('/requests?status=4')} />
        <StatCard icon={<Icon name="resolved" />} value={stats.resolved} label={t('common.resolved')} change={getChangePercent(stats.resolved, stats.resolvedLastWeek).text} changeType={getChangePercent(stats.resolved, stats.resolvedLastWeek).type} changeLabel={changeLabel} color="#8B5CF6" onClick={() => navigate('/requests?status=5')} />
        <StatCard icon={<Icon name="escalated" />} value={stats.escalated} label={t('common.escalated')} change={getChangePercent(stats.escalated, stats.escalatedLastWeek).text} changeType={getChangePercent(stats.escalated, stats.escalatedLastWeek).type} changeLabel={changeLabel} color="#EF4444" onClick={() => navigate('/requests?status=9')} />
        <StatCard icon={<Icon name="closed" />} value={stats.closed} label={t('common.closed')} change={getChangePercent(stats.closed, stats.closedLastWeek).text} changeType={getChangePercent(stats.closed, stats.closedLastWeek).type} changeLabel={changeLabel} color="#6B7280" onClick={() => navigate('/requests?status=6')} />
        <StatCard icon={<Icon name="rejected" />} value={stats.rejected} label={t('common.rejected')} change={getChangePercent(stats.rejected, stats.rejectedLastWeek).text} changeType={getChangePercent(stats.rejected, stats.rejectedLastWeek).type} changeLabel={changeLabel} color="#DC2626" onClick={() => navigate('/requests?status=8')} />
      </div>

      <div className="charts-row">
        <div className="chart-card" style={{ flex: 1 }}>
          <h3>{t('dashboard.requestsByStatus')}</h3>
          <div className="chart-container pie-chart-layout">
            <div className="pie-chart-area">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.byStatus.filter(s => s.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {stats.byStatus.filter(s => s.count > 0).map((entry, i) => (
                      <Cell key={entry.id || entry.name} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, transSeeded(String(name), 'status', t)]} />
                  <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize={28} fontWeight={700} fill="currentColor">
                    {stats.byStatus.filter(s => s.count > 0).reduce((sum, s) => sum + s.count, 0)}
                  </text>
                  <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="currentColor" className="muted-text">
                    {t('common.total')}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {stats.byStatus.filter(s => s.count > 0).map((s, i) => (
                <div key={s.id} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                  <span className="legend-label">{transSeeded(s.name, 'status', t)}</span>
                  <span className="legend-value">{s.count} ({s.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ flex: 1 }}>
          <h3>{t('dashboard.requestsByPriority')}</h3>
          <div className="chart-container pie-chart-layout">
            <div className="pie-chart-area">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={stats.byPriority.filter(p => p.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {stats.byPriority.filter(p => p.count > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, transSeeded(String(name), 'priority', t)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {stats.byPriority.filter(p => p.count > 0).map((p, i) => (
                <div key={p.id} className="legend-item">
                  <span className="legend-dot" style={{ background: p.color || COLORS[i % COLORS.length] }}></span>
                  <span className="legend-label">{transSeeded(p.name, 'priority', t)}</span>
                  <span className="legend-value">{p.count} ({p.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="chart-card" style={{ flex: 1 }}>
          <h3>{t('dashboard.requestsOverviewWeek')}</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip />
                <Legend formatter={(value) => ({ created: t('common.new'), resolved: t('common.resolved'), closed: t('common.closed') }[value] || value)} />
                <Line type="monotone" dataKey="created" name={t('common.new')} stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" name={t('common.resolved')} stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="closed" name={t('common.closed')} stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card" style={{ flex: 3 }}>
          <h3>{t('dashboard.requestsByCompany')}</h3>
          <div className="chart-container pie-chart-layout">
            <div className="pie-chart-area">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={(stats.byCompany || []).filter(c => c.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                    {(stats.byCompany || []).filter(c => c.count > 0).map((entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              {(stats.byCompany || []).filter(c => c.count > 0).map((c, i) => (
                <div key={i} className="legend-item">
                  <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }}></span>
                  <span className="legend-label">{c.name}</span>
                  <span className="legend-value">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="chart-card" style={{ gridColumn: '2 / -1' }}>
          <h3>{t('dashboard.requestsByCategory')}</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={(stats.byCategory || []).filter(c => c.count > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} tickFormatter={(value) => transSeeded(value, 'category', t)} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip formatter={(value, name, props) => [value, props?.payload ? transSeeded(props.payload.name, 'category', t) : name]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {(stats.byCategory || []).filter(c => c.count > 0).map((entry, i) => (
                    <Cell key={entry.id || entry.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <h3>{t('dashboard.latestRequests')}</h3>
          <div className="table-header-actions">
            <div className="table-search-box">
              <span className="search-icon"></span>
              <input
                type="text"
                placeholder={t('common.searchRequests')}
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
                <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.id')} {getSortIcon('id')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.requestTitle')} {getSortIcon('subject')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('assignedTo')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.assignedTo')} {getSortIcon('assignedTo')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.client')} {getSortIcon('client')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('groups')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.assignedGroup')} {getSortIcon('groups')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.category')} {getSortIcon('category')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('priority')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.priority')} {getSortIcon('priority')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.status')} {getSortIcon('status')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.created')} {getSortIcon('createdAt')}</span></th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map(r => (
                <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                  <td><strong>{t('common.requestPrefixLabel')}{String(r.id).padStart(4, '0')}</strong></td>
                  <td><span className="truncate-cell">{r.subject}</span></td>
                  <td>
                    {r.assignee && r.status?.name !== 'New' ? (
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: '#3B82F6', overflow: 'hidden' }}>
                          {getAvatarUrl(r.assignee.avatar) ? <img src={getAvatarUrl(r.assignee.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : r.assignee.name.charAt(0)}
                        </div>
                        <span className="truncate-cell">{r.assignee.name}</span>
                      </div>
                    ) : <span className="muted-text">-</span>}
                  </td>
                  <td>
                    {r.clientDeleted ? (
                      <span className="muted-text">{t('common.clientDeleted')}</span>
                    ) : r.client?.name || r.clientName || r.client_name ? (
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: '#10B981', overflow: 'hidden' }}>
                          {getAvatarUrl(r.client?.avatar) ? <img src={getAvatarUrl(r.client?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((r.client?.name || r.clientName || r.client_name).charAt(0) || '?')}
                        </div>
                        <span className="truncate-cell">{r.client?.name || r.clientName || r.client_name}</span>
                      </div>
                    ) : (
                      <span className="muted-text">-</span>
                    )}
                  </td>
                  <td>
                    {r.groups && r.groups.length > 0
                      ? <span className="truncate-cell">{r.groups.map((g, i) => (
                          <span key={g.id} className="group-tag" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', marginRight: i < r.groups.length - 1 ? '4px' : 0 }}>
                            {g.name}
                          </span>
                        ))}</span>
                      : '-'}
                  </td>
                  <td><span className="truncate-cell"><span className="category-tag" style={{ background: (r.category?.color || '#3B82F6') + '20', color: r.category?.color || '#3B82F6' }}>{transSeeded(r.category?.name || r.categoryName || r.category_name, 'category', t) || '-'}</span></span></td>
                  <td>
                    <span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>
                      {transSeeded(r.priorityName || r.priority?.name, 'priority', t) || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>
                      {transSeeded(r.statusName || r.status?.name, 'status', t) || '-'}
                    </span>
                  </td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {r.status?.name === 'New' || r.status?.name === 'Assigned' ? (
                        <>
                          <button className="action-btn-text edit" onClick={() => navigate(`/requests/${r.id}?edit=true`)}>{t('common.edit')}</button>
                          <button className="action-btn-text delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.id); }}>{t('common.delete')}</button>
                        </>
                      ) : (
                        <span className="muted-text" style={{ fontSize: 12, fontStyle: 'italic' }}>-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRequests.length === 0 && (
                <tr><td colSpan="10" className="muted-text" style={{ textAlign: 'center', padding: '24px' }}>{t('common.noRequestsFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <div className="table-footer-info">
            <span>{t('common.show')}</span>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
            <span>{t('common.ofRequests', { count: filteredRequests.length })}</span>
          </div>
          <div className="table-pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
            <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
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
              {t('dashboard.companyPerformance')}
            </button>
            <button
              className={`perf-toggle-btn ${perfView === 'developer' ? 'active' : ''}`}
              onClick={() => setPerfView('developer')}
            >
              {t('dashboard.developerPerformance')}
            </button>
          </div>

          {perfView === 'company' && (
            <div className="charts-row">
              <div className="chart-card wide">
                <div className="perf-header">
                  <h3>{t('dashboard.companyPerformance30')}</h3>
                  <p className="perf-subtitle">{t('dashboard.companyPerfSubtitle')}</p>
                </div>
                <div className="perf-charts-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="perf-chart-section">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={perfData.companyStats || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} angle={-20} textAnchor="end" height={60} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          cursor={{ fill: '#f9fafb' }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: 16 }}
                          iconType="circle"
                          iconSize={10}
                        />
                        {STATUS_CONFIG.filter(s => {
                          const data = perfData.companyStats || [];
                          return data.some(d => d[s.key] > 0);
                        }).map(s => (
                          <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={transSeeded(s.key, 'status', t)}
                            fill={s.color}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={24}
                            cursor="pointer"
                            onClick={(data) => {
                              const item = perfData.byCompany.find(c => c.name === data?.name);
                              if (item) setSelectedDetail({ type: 'company', data: item });
                            }}
                          />
                        ))}
                      </BarChart>
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
                  <h3>{t('dashboard.developerPerformance30')}</h3>
                  <p className="perf-subtitle">{t('dashboard.developerPerfSubtitle')}</p>
                </div>
                <div className="perf-charts-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <div className="perf-chart-section">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={perfData.developerStats || []} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} angle={-20} textAnchor="end" height={60} />
                        <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          cursor={{ fill: '#f9fafb' }}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: 16 }}
                          iconType="circle"
                          iconSize={10}
                        />
                        {STATUS_CONFIG.filter(s => {
                          const data = perfData.developerStats || [];
                          return data.some(d => d[s.key] > 0);
                        }).map(s => (
                          <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={transSeeded(s.key, 'status', t)}
                            fill={s.color}
                            radius={[3, 3, 0, 0]}
                            maxBarSize={24}
                            cursor="pointer"
                            onClick={(data) => {
                              const item = perfData.byDeveloper.find(d => d.name === data?.name);
                              if (item) setSelectedDetail({ type: 'developer', data: item });
                            }}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedDetail && (
        <div className="modal-overlay" onClick={() => setSelectedDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div>
                  <h2>{selectedDetail.data.name} - {t('dashboard.dailyBreakdown')}</h2>
                  <p className="modal-subtitle">{t('dashboard.last30Days')}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="stats-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))' }}>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#3B82F6' }}>
                    {selectedDetail.data.data.reduce((s, d) => s + d.created, 0)}
                  </div>
                  <div className="muted-text" style={{ fontSize: 12 }}>{t('dashboard.totalCreated')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#10B981' }}>
                    {selectedDetail.data.data.reduce((s, d) => s + d.resolved, 0)}
                  </div>
                  <div className="muted-text" style={{ fontSize: 12 }}>{t('dashboard.totalResolved')}</div>
                </div>
                <div className="stat-card" style={{ padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}>
                    {(() => {
                      const created = selectedDetail.data.data.reduce((s, d) => s + d.created, 0);
                      const resolved = selectedDetail.data.data.reduce((s, d) => s + d.resolved, 0);
                      return created ? Math.round((resolved / created) * 100) + '%' : '0%';
                    })()}
                  </div>
                  <div className="muted-text" style={{ fontSize: 12 }}>{t('dashboard.resolutionRate')}</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={selectedDetail.data.data.map(d => ({ ...d }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="created" name={t('common.created')} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name={t('common.resolved')} fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSelectedDetail(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>{t('common.deleteRequestConfirm')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteTarget)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

