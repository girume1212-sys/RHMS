import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api, API_BASE } from '../api';
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, ResponsiveContainer } from 'recharts';
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

// Performance is a percentage, so its axis is pinned to 0-100 with a fixed tick
// set. Recharts therefore cannot auto-fit the scale, and a 70% point sits
// exactly on the 70% tick while 90% sits on the 90% tick: the series is never
// stretched or compressed to fit the data.
const RATE_AXIS = { domain: [0, 100], ticks: [0, 25, 50, 75, 100] };

// Two soft, low-saturation tones so the two performance series stay readable
// side by side: muted indigo for the Escalation Team, muted teal for
// Developers. Each is paired with a vertical gradient that fades to almost
// nothing, keeping the shaded area light rather than a saturated block.
const PERF_TONES = {
  escalation: { line: '#818CF8', fillFrom: '#818CF8', fillTo: '#C7D2FE' },
  developer: { line: '#5EEAD4', fillFrom: '#5EEAD4', fillTo: '#CCFBF1' }
};

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#F97316', '#10B981', '#6B7280', '#EF4444'];

function StatCard({ icon, value, label, change, changeType, color, onClick, changeLabel }) {
  return (
    <div className={`stat-card${onClick ? ' stat-card-interactive' : ''}`}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        '--stat-accent': color,
        '--stat-shadow': `${color}30`
      }}
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

// Tooltip for the shaded performance trend charts. It leads with the exact
// performance percentage, then lists the underlying counts that produced it so
// the rate is never a number without context. `rows` describes the count rows
// to show, `tone` tints the percentage badge to match that chart's line.
function PerfTooltip({ active, payload, t, rows, tone, rateLabelKey, formatHours, sublabel, showHours }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const sublabelText = typeof sublabel === 'function' ? sublabel(row) : sublabel;
  const rate = Number(row.successRate) || 0;
  return (
    <div className="esc-tooltip">
      <div className="esc-tooltip-title">{row.label || row.name}</div>
      {sublabelText && <div className="esc-tooltip-subtitle">{sublabelText}</div>}
      <div className="perf-rate-row">
        <span className="perf-rate-badge" style={{ color: tone }}>{rate}%</span>
        <span className="perf-rate-caption">{t(rateLabelKey)}</span>
      </div>
      <div className="perf-rate-counts">
        {rows.map(r => (
          <div className="esc-tooltip-row" key={r.dataKey}>
            <span className="esc-tooltip-dot" style={{ background: r.color }} />
            <span className="esc-tooltip-label">{t(r.labelKey)}</span>
            <span className="esc-tooltip-value">{Number(row[r.dataKey]) || 0}</span>
          </div>
        ))}
        {showHours && (
          <div className="esc-tooltip-row esc-tooltip-footer">
            <span className="esc-tooltip-dot" style={{ background: tone }} />
            <span className="esc-tooltip-label">{t('dashboard.avgResolutionTime')}</span>
            <span className="esc-tooltip-value">{formatHours(row.avgResolutionHours)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const WEEK_SERIES = [
  { key: 'created', labelKey: 'common.new', color: '#3B82F6' },
  { key: 'resolved', labelKey: 'common.resolved', color: '#10B981' },
  { key: 'closed', labelKey: 'common.closed', color: '#8B5CF6' },
];

const RANGE_OPTIONS = [
  { days: 7, labelKey: 'dashboard.range7' },
  { days: 30, labelKey: 'dashboard.range30' },
  { days: 90, labelKey: 'dashboard.range90' },
  { days: 'all', labelKey: 'dashboard.rangeAll' },
];

export default function Dashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [recentRequests, setRecentRequests] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [perfData, setPerfData] = useState(null);
  const [escPerfData, setEscPerfData] = useState(null);
  const [perfView, setPerfView] = useState('escalation');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rangeDays, setRangeDays] = useState('all');
  const escPerfCardRef = useRef(null);
  const [escPerfCardHeight, setEscPerfCardHeight] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const changeLabel = t('common.fromLastWeek');

  useEffect(() => {
    api.get(`/api/dashboard/stats?days=${rangeDays}`).then(setStats).catch(err => setError(t('common.failedToLoadDashboard') + ' ' + err.message));
  }, [user, rangeDays]);

  useEffect(() => {
    api.get('/api/requests').then(data => {
      let filtered = data;
      if (user?.role === 'developer' || user?.role === 'support') {
        filtered = data.filter(r => r.assignedTo === user.id || !r.assignedTo);
      }
      setRecentRequests(filtered);
    }).catch(err => setError(t('common.failedToLoadRequests') + ' ' + err.message));
    api.get('/api/dashboard/performance?days=30').then(setPerfData).catch(err => console.error('Perf fetch error:', err));
  }, [user]);

  useEffect(() => {
    api.get(`/api/dashboard/escalation-performance?days=${rangeDays}`)
      .then(setEscPerfData)
      .catch(err => console.error('Escalation perf fetch error:', err));
  }, [user, rangeDays]);

  // Both performance cards share the same shell (.charts-row > .chart-card.wide,
  // 5 KPI cards, 400px chart). The escalation card's KPI hint row and legend
  // note are mirrored as invisible placeholders in the developer card, so both
  // cards are naturally the same width and height. The measured min-height is
  // kept only as a safety net for font/translation differences. Only the
  // escalation card is observed, so resizing the developer card can never feed
  // back into the measurement.
  useEffect(() => {
    const el = escPerfCardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      setEscPerfCardHeight(prev => (Math.abs(prev - h) < 1 ? prev : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [perfView, escPerfData, rangeDays]);

  const weekData = useMemo(() => (stats?.dailyData || []).map(d => ({
    ...d,
    created: Number(d.created) || 0,
    resolved: Number(d.resolved) || 0,
    closed: Number(d.closed) || 0
  })), [stats?.dailyData]);

  const weekTotals = useMemo(() => weekData.reduce((acc, d) => ({
    created: acc.created + d.created,
    resolved: acc.resolved + d.resolved,
    closed: acc.closed + d.closed
  }), { created: 0, resolved: 0, closed: 0 }), [weekData]);

  // Count rows shown underneath the percentage in each performance tooltip.
  // These are the same numbers the series is computed from, so the rate always
  // has its inputs visible.
  const ESC_COUNT_ROWS = useMemo(() => ([
    { dataKey: 'totalEscalated', labelKey: 'dashboard.totalEscalated', color: '#3B82F6' },
    { dataKey: 'resolvedEscalated', labelKey: 'dashboard.resolvedEscalated', color: '#10B981' },
    { dataKey: 'pendingEscalated', labelKey: 'dashboard.pendingEscalated', color: '#F59E0B' }
  ]), []);

  const escMetrics = escPerfData?.metrics || null;

  const DEV_COUNT_ROWS = useMemo(() => ([
    { dataKey: 'assigned', labelKey: 'dashboard.assignedToDev', color: '#8B5CF6' },
    { dataKey: 'inProgress', labelKey: 'dashboard.inProgressDev', color: '#F59E0B' },
    { dataKey: 'resolved', labelKey: 'dashboard.resolvedDev', color: '#10B981' }
  ]), []);

  // Developer chart: only real developer users (users.role === 'developer').
  // Anything else from the API is dropped here as a guard so Escalation Team
  // (support) names can never render in this chart.
  const devChartData = useMemo(() => {
    const rows = escPerfData?.developers;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .filter(row => row && row.role === 'developer' && row.name)
      .map(row => ({
        name: row.name,
        role: row.role || null,
        label: row.name,
        assigned: Number(row.assigned) || 0,
        inProgress: Number(row.inProgress) || 0,
        resolved: Number(row.resolved) || 0,
        avgResolutionHours: row.avgResolutionHours ?? null,
        successRate: Number(row.successRate) || 0
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [escPerfData?.developers]);

  const devTotalAssigned = useMemo(
    () => devChartData.reduce((sum, d) => sum + d.assigned, 0),
    [devChartData]
  );

  // Team-wide success rate, weighted by workload, rather than an unweighted
  // mean of per-developer percentages.
  const devSuccessRate = useMemo(() => {
    if (devTotalAssigned === 0) return 0;
    const resolved = devChartData.reduce((s, d) => s + d.resolved, 0);
    return Math.round((resolved / devTotalAssigned) * 1000) / 10;
  }, [devChartData, devTotalAssigned]);

  const devKpis = useMemo(() => {
    if (devChartData.length === 0) return [];
    const sum = key => devChartData.reduce((s, d) => s + d[key], 0);
    return [
      { key: 'developers', labelKey: 'role.developers', color: '#3B82F6', value: devChartData.length },
      { key: 'total', labelKey: 'dashboard.totalAssigned', color: '#8B5CF6', value: devTotalAssigned },
      { key: 'open', labelKey: 'dashboard.inProgressDev', color: '#F59E0B', value: sum('inProgress') },
      { key: 'done', labelKey: 'dashboard.resolvedDev', color: '#10B981', value: sum('resolved') },
      { key: 'avg', labelKey: 'dashboard.developerSuccessRate', color: '#EF4444', value: `${devSuccessRate}%` }
    ];
  }, [devChartData, devTotalAssigned, devSuccessRate]);

  const escRangeLabel = useMemo(() => {
    if (rangeDays === 7) return t('dashboard.escalationRange7');
    if (rangeDays === 30) return t('dashboard.escalationRange30');
    if (rangeDays === 90) return t('dashboard.escalationRange90');
    return t('dashboard.escalationRangeAll');
  }, [rangeDays, t]);

  // One bar group per Support/Escalation team member, named from the database
  // (users.name via requests.assigned_to). The rows come from the same
  // escalations set the KPIs above are computed from, so they always add up to
  // the totals. Escalated requests with nobody assigned are kept as a single
  // Escalation chart: only real Escalation/Support team members
  // (users.role === 'support'). Anything else from the API is dropped here
  // as a guard so Developer names can never render in this chart.
  const escTeam = useMemo(() => {
    const rows = escPerfData?.team;
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows
      .filter(row => row && row.role === 'support' && row.name)
      .map(row => ({
        userId: row.userId || null,
        name: row.name || null,
        role: row.role || null,
        totalEscalated: Number(row.total) || 0,
        resolvedEscalated: Number(row.resolved) || 0,
        pendingEscalated: Number(row.pending) || 0,
        avgResolutionHours: row.avgResolutionHours ?? null,
        successRate: Number(row.successRate) || 0
      }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [escPerfData?.team]);

  // X-axis label: the real member name, or the unassigned label when the
  // request had nobody attached. Kept short so the axis stays readable.
  const escTeamLabel = useCallback((row) => (
    row.name || t('dashboard.unassignedMember')
  ), [t]);

  // Role label shared by both performance tooltips.
  const perfRoleLabel = useCallback((row) => {
    if (!row || !row.role) return '';
    if (row.role === 'support') return t('role.support');
    if (row.role === 'developer') return t('role.developer');
    if (row.role === 'admin') return t('role.admin');
    return row.role;
  }, [t]);

  const escChartData = useMemo(() => {
    if (escTeam.length > 0) {
      return escTeam.map(row => ({
        ...row,
        label: escTeamLabel(row)
      }));
    }
    // Fallback to the single aggregate column if no per-member rows came back.
    if (!escMetrics) return [];
    return [{
      userId: null,
      name: null,
      role: null,
      label: escRangeLabel,
      totalEscalated: escMetrics.totalEscalated || 0,
      resolvedEscalated: escMetrics.resolvedEscalated || 0,
      pendingEscalated: escMetrics.pendingEscalated || 0,
      avgResolutionHours: escMetrics.avgResolutionHours ?? null,
      successRate: escMetrics.successRate || 0
    }];
  }, [escTeam, escMetrics, escRangeLabel, escTeamLabel]);

  const escKpis = useMemo(() => {
    if (!escMetrics) return [];
    return [
      { key: 'totalEscalated', labelKey: 'dashboard.totalEscalated', color: '#3B82F6', value: escMetrics.totalEscalated ?? 0 },
      { key: 'resolvedEscalated', labelKey: 'dashboard.resolvedEscalated', color: '#10B981', value: escMetrics.resolvedEscalated ?? 0 },
      { key: 'pendingEscalated', labelKey: 'dashboard.pendingEscalated', color: '#F59E0B', value: escMetrics.pendingEscalated ?? 0 },
      {
        key: 'avgResolutionHours',
        labelKey: 'dashboard.avgResolutionTime',
        color: '#8B5CF6',
        hintKey: 'dashboard.escalationAvgBasis',
        value: escMetrics.avgResolutionHours === null || escMetrics.avgResolutionHours === undefined
          ? '—'
          : `${escMetrics.avgResolutionHours} h`
      },
      { key: 'successRate', labelKey: 'dashboard.escalationSuccessRate', color: '#EF4444', value: `${escMetrics.successRate ?? 0}%` }
    ];
  }, [escMetrics]);

  const escFormatHours = useCallback((hours) => {
    const n = Number(hours);
    if (!Number.isFinite(n)) return '—';
    if (n < 1) return `${Math.round(n * 60)} min`;
    if (n < 48) return `${Math.round(n * 10) / 10} h`;
    return `${Math.round((n / 24) * 10) / 10} d`;
  }, []);

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
        <StatCard icon={<Icon name="total" />} value={stats.total} label={t('common.totalRequests')} change={getChangePercent(stats.total, stats.totalLastWeek).text} changeType={getChangePercent(stats.total, stats.totalLastWeek).type} changeLabel={changeLabel} color="#FACC15" onClick={() => navigate('/requests')} />
        <StatCard icon={<Icon name="new" />} value={stats.open} label={t('common.newRequests')} change={getChangePercent(stats.open, stats.openLastWeek).text} changeType={getChangePercent(stats.open, stats.openLastWeek).type} changeLabel={changeLabel} color="#3B82F6" onClick={() => navigate('/requests?status=1')} />
        <StatCard icon={<Icon name="assigned" />} value={stats.assigned} label={t('common.assigned')} change={getChangePercent(stats.assigned, stats.assignedLastWeek).text} changeType={getChangePercent(stats.assigned, stats.assignedLastWeek).type} changeLabel={changeLabel} color="#8B5CF6" onClick={() => navigate('/requests?status=2')} />
        <StatCard icon={<Icon name="inProgress" />} value={stats.inProgress} label={t('common.inProgress')} change={getChangePercent(stats.inProgress, stats.inProgressLastWeek).text} changeType={getChangePercent(stats.inProgress, stats.inProgressLastWeek).type} changeLabel={changeLabel} color="#F59E0B" onClick={() => navigate('/requests?status=3')} />
        <StatCard icon={<Icon name="waiting" />} value={stats.waiting} label={t('common.waitingForClient')} change={getChangePercent(stats.waiting, stats.waitingLastWeek).text} changeType={getChangePercent(stats.waiting, stats.waitingLastWeek).type} changeLabel={changeLabel} color="#F97316" onClick={() => navigate('/requests?status=4')} />
        <StatCard icon={<Icon name="resolved" />} value={stats.resolved} label={t('common.resolved')} change={getChangePercent(stats.resolved, stats.resolvedLastWeek).text} changeType={getChangePercent(stats.resolved, stats.resolvedLastWeek).type} changeLabel={changeLabel} color="#10B981" onClick={() => navigate('/requests?status=5')} />
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
          <div className="chart-card-header">
            <div>
              <h3>{t('dashboard.requestsOverview')}</h3>
              <p className="chart-subtitle">{t('dashboard.requestsOverviewSubtitle')}</p>
            </div>
            <div className="range-toggle" role="group" aria-label={t('dashboard.requestsOverview')}>
              {RANGE_OPTIONS.map(r => (
                <button
                  key={r.days}
                  type="button"
                  className={`range-toggle-btn ${rangeDays === r.days ? 'active' : ''}`}
                  onClick={() => setRangeDays(r.days)}
                >
                  {t(r.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container overview-chart">
            {weekData.length === 0 ? (
              <div className="chart-empty">{t('common.noData')}</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weekData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <defs>
                    {WEEK_SERIES.map(s => (
                      <linearGradient key={s.key} id={`weekFill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickMargin={6}
                    interval={weekData.length > 14 ? 'preserveStartEnd' : 0}
                    minTickGap={4}
                  />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} allowDecimals={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                    cursor={{ stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '4 4' }}
                    formatter={(value, name) => [value, t(WEEK_SERIES.find(s => t(s.labelKey) === name)?.labelKey || 'common.total')]}
                  />
                  <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} iconType="circle" iconSize={10} />
                  {WEEK_SERIES.map(s => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={t(s.labelKey)}
                      stroke={s.color}
                      strokeWidth={2}
                      fill={`url(#weekFill-${s.key})`}
                      fillOpacity={1}
                      connectNulls
                      dot={weekData.length > 14 ? false : { r: 3, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {weekData.length > 0 && (
            <div className="chart-summary">
              {WEEK_SERIES.map(s => (
                <div key={s.key} className="chart-summary-item">
                  <span className="legend-dot" style={{ background: s.color }}></span>
                  <span className="chart-summary-label">{t(s.labelKey)}</span>
                  <span className="chart-summary-value">{weekTotals[s.key]}</span>
                </div>
              ))}
            </div>
          )}
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
              <span className="search-icon"><Icon name="search" size={14} /></span>
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
                          {r.status?.name === 'Assigned' && (
                            <button className="action-btn-text edit" onClick={() => navigate(`/requests/${r.id}?edit=true`)}>{t('common.edit')}</button>
                          )}
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

      {(escPerfData || perfData) && (
        <div className="performance-section">
          <div className="perf-toggle-container">
            <button
              className={`perf-toggle-btn ${perfView === 'escalation' ? 'active' : ''}`}
              onClick={() => setPerfView('escalation')}
            >
              {t('dashboard.escalationPerformance')}
            </button>
            <button
              className={`perf-toggle-btn ${perfView === 'developer' ? 'active' : ''}`}
              onClick={() => setPerfView('developer')}
            >
              {t('dashboard.developerPerformance')}
            </button>
          </div>

          {perfView === 'escalation' && (
            <div className="charts-row">
              <div className="chart-card wide" ref={escPerfCardRef}>
                <div className="perf-header">
                  <h3>{t('dashboard.escalationPerformance')}</h3>
                  <p className="perf-subtitle">{t('dashboard.escalationPerfSubtitle')}</p>
                </div>
                {!escMetrics ? (
                  <div className="esc-empty">
                    <div className="spinner"></div>
                  </div>
                ) : escMetrics.totalEscalated === 0 ? (
                  <div className="esc-empty">
                    <Icon name="escalated" size={32} />
                    <div>{t('dashboard.noEscalationData')}</div>
                  </div>
                ) : (
                  <>
                    <div className="esc-kpi-grid">
                      {escKpis.map(kpi => (
                        <div
                          key={kpi.key}
                          className="esc-kpi"
                          style={{ '--esc-kpi-accent': kpi.color, '--esc-kpi-shadow': `${kpi.color}30` }}
                        >
                          <div className="esc-kpi-value">{kpi.value}</div>
                          <div className="esc-kpi-label">{t(kpi.labelKey)}</div>
                          {kpi.hintKey && <div className="esc-kpi-hint">{t(kpi.hintKey)}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="perf-charts-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="perf-chart-section">
                        <ResponsiveContainer width="100%" height={530}>
                          <AreaChart
                            data={escChartData}
                            margin={{ top: 24, right: 28, left: 60, bottom: 100 }}
                          >
                            <defs>
                              <linearGradient id="escPerfArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={PERF_TONES.escalation.fillFrom} stopOpacity={0.35} />
                                <stop offset="70%" stopColor={PERF_TONES.escalation.fillTo} stopOpacity={0.12} />
                                <stop offset="100%" stopColor={PERF_TONES.escalation.fillTo} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="#9ca3af"
                              fontSize={12}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                              angle={-20}
                              textAnchor="end"
                              interval={0}
                              height={100}
                              tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              stroke="#9ca3af"
                              fontSize={12}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                              domain={RATE_AXIS.domain}
                              ticks={RATE_AXIS.ticks}
                              allowDecimals={false}
                              width={56}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={value => `${value}%`}
                              label={{
                                value: t('dashboard.successRateAxis'),
                                angle: 90,
                                position: 'insideRight',
                                offset: 12,
                                className: 'esc-axis-label'
                              }}
                            />
                            <Tooltip
                              cursor={{ stroke: PERF_TONES.escalation.line, strokeWidth: 1, strokeDasharray: '4 4' }}
                              content={(
                                <PerfTooltip
                                  rows={ESC_COUNT_ROWS}
                                  tone={PERF_TONES.escalation.line}
                                  rateLabelKey="dashboard.escalationSuccessRate"
                                  sublabel={perfRoleLabel}
                                  showHours
                                  formatHours={escFormatHours}
                                  t={t}
                                />
                              )}
                            />
                            <Legend
                              verticalAlign="top"
                              align="left"
                              height={28}
                              iconType="plainline"
                              iconSize={22}
                              wrapperStyle={{ fontSize: 12, color: '#4b5563' }}
                            />
                            <Area
                              yAxisId="right"
                              type="monotone"
                              dataKey="successRate"
                              name={t('dashboard.escalationPerformance')}
                              stroke={PERF_TONES.escalation.line}
                              strokeWidth={2.5}
                              fill="url(#escPerfArea)"
                              dot={{ r: 4.5, fill: PERF_TONES.escalation.line, stroke: '#fff', strokeWidth: 2 }}
                              activeDot={{ r: 7, fill: PERF_TONES.escalation.line, stroke: '#fff', strokeWidth: 2 }}
                              connectNulls
                              isAnimationActive={false}
                              label={(
                                <LabelList
                                  dataKey="successRate"
                                  position="top"
                                  offset={10}
                                  formatter={value => `${value}%`}
                                  fill="#4b5563"
                                  fontSize={12}
                                  fontWeight={700}
                                />
                              )}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <p className="esc-legend-note">{t('dashboard.escalationAvgBasis')}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {perfView === 'developer' && (
            <div className="charts-row">
              <div className="chart-card wide" style={escPerfCardHeight ? { minHeight: escPerfCardHeight } : undefined}>
                <div className="perf-header">
                  <h3>{t('dashboard.developerPerformanceBar')}</h3>
                  <p className="perf-subtitle">{t('dashboard.developerPerfBarSubtitle', { range: escRangeLabel })}</p>
                </div>
                {!escPerfData ? (
                  <div className="esc-empty">
                    <div className="spinner"></div>
                  </div>
                ) : devChartData.length === 0 ? (
                  <div className="esc-empty">
                    <Icon name="escalated" size={32} />
                    <div>{t('dashboard.noDeveloperPerfData')}</div>
                  </div>
                ) : (
                  <>
                    <div className="esc-kpi-grid">
                      {devKpis.map((kpi, index) => (
                        <div
                          key={kpi.key}
                          className="esc-kpi"
                          style={{ '--esc-kpi-accent': kpi.color, '--esc-kpi-shadow': `${kpi.color}30` }}
                        >
                          <div className="esc-kpi-value">{kpi.value}</div>
                          <div className="esc-kpi-label">{t(kpi.labelKey)}</div>
                          {index === escKpis.findIndex(kpi => kpi.hintKey) && (
                            <div className="esc-kpi-hint" aria-hidden="true" style={{ visibility: 'hidden' }}>
                              {t('dashboard.escalationAvgBasis')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="perf-charts-grid" style={{ gridTemplateColumns: '1fr' }}>
                      <div className="perf-chart-section">
                        <ResponsiveContainer width="100%" height={530}>
                          <AreaChart
                            data={devChartData}
                            margin={{ top: 24, right: 28, left: 60, bottom: 100 }}
                            onClick={(state) => {
                              // preserve the existing per-developer drilldown
                              const name = state?.activePayload?.[0]?.payload?.name;
                              const item = (perfData?.byDeveloper || []).find(d => d.name === name);
                              if (item) setSelectedDetail({ type: 'developer', data: item });
                            }}
                            style={{ cursor: 'pointer' }}
                          >
                            <defs>
                              <linearGradient id="devPerfArea" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={PERF_TONES.developer.fillFrom} stopOpacity={0.35} />
                                <stop offset="70%" stopColor={PERF_TONES.developer.fillTo} stopOpacity={0.12} />
                                <stop offset="100%" stopColor={PERF_TONES.developer.fillTo} stopOpacity={0.02} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="#9ca3af"
                              fontSize={12}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                              angle={-20}
                              textAnchor="end"
                              height={100}
                              interval={0}
                              tick={{ fill: '#4b5563', fontSize: 12, fontWeight: 600 }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              stroke="#9ca3af"
                              fontSize={12}
                              tickLine={false}
                              axisLine={{ stroke: '#e5e7eb' }}
                              domain={RATE_AXIS.domain}
                              ticks={RATE_AXIS.ticks}
                              allowDecimals={false}
                              width={56}
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              tickFormatter={value => `${value}%`}
                              label={{
                                value: t('dashboard.successRateAxis'),
                                angle: 90,
                                position: 'insideRight',
                                offset: 12,
                                className: 'esc-axis-label'
                              }}
                            />
                            <Tooltip
                              cursor={{ stroke: PERF_TONES.developer.line, strokeWidth: 1, strokeDasharray: '4 4' }}
                              content={(
                                <PerfTooltip
                                  rows={DEV_COUNT_ROWS}
                                  tone={PERF_TONES.developer.line}
                                  rateLabelKey="dashboard.developerPerformance"
                                  showHours
                                  formatHours={escFormatHours}
                                  t={t}
                                />
                              )}
                            />
                            <Legend
                              verticalAlign="top"
                              align="left"
                              height={28}
                              iconType="plainline"
                              iconSize={22}
                              wrapperStyle={{ fontSize: 12, color: '#4b5563' }}
                            />
                            <Area
                              yAxisId="right"
                              type="monotone"
                              dataKey="successRate"
                              name={t('dashboard.developerPerformance')}
                              stroke={PERF_TONES.developer.line}
                              strokeWidth={2.5}
                              fill="url(#devPerfArea)"
                              dot={{ r: 4.5, fill: PERF_TONES.developer.line, stroke: '#fff', strokeWidth: 2 }}
                              activeDot={{ r: 7, fill: PERF_TONES.developer.line, stroke: '#fff', strokeWidth: 2 }}
                              connectNulls
                              isAnimationActive={false}
                              label={(
                                <LabelList
                                  dataKey="successRate"
                                  position="top"
                                  offset={10}
                                  formatter={value => `${value}%`}
                                  fill="#4b5563"
                                  fontSize={12}
                                  fontWeight={700}
                                />
                              )}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                        <p className="esc-legend-note" aria-hidden="true" style={{ visibility: 'hidden' }}>
                          {t('dashboard.escalationAvgBasis')}
                        </p>
                      </div>
                    </div>
                  </>
                )}
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

