import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';
import RequestCalendar from './RequestCalendar';
import PageNumbers from './PageNumbers';
import Icon from './Icon';
import { usePageBack } from '../utils/sidebarNav';
import { API_BASE } from '../api';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

export default function EscalationDashboard() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = usePageBack('/');

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
      api.get('/api/users'),
      api.get('/api/groups')
    ]).then(([requestsData, statusesData, usersData, groupsData]) => {
      setRequests(requestsData);
      setStatuses(statusesData);
      setUsers(usersData);
      setGroups(groupsData);
    }).catch(err => setError(t('common.failedToLoadData') + ' ' + err.message));
  };

  useEffect(() => {
    loadData();
  }, [showAssignedOnly]);

  const developers = users.filter(u => u.role === 'developer');
  const displayRequests = showAssignedOnly
    ? requests.filter(r => r.assignedTo === user.id && r.status?.name !== 'New')
    : requests;

  const stats = {
    total: displayRequests.length,
    newCount: displayRequests.filter(r => r.status?.name === 'New').length,
    inProgress: displayRequests.filter(r => r.status?.name === 'In Progress').length,
    waiting: displayRequests.filter(r => r.status?.name === 'Waiting for Client').length,
    resolved: displayRequests.filter(r => r.status?.name === 'Resolved').length,
    assigned: displayRequests.filter(r => r.status?.name === 'Assigned').length,
    escalated: displayRequests.filter(r => r.status?.name === 'Escalated').length,
    closed: displayRequests.filter(r => r.status?.name === 'Closed').length,
    rejected: displayRequests.filter(r => r.status?.name === 'Rejected').length,
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
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: status, assignedTo: statusName === 'New' ? null : r.assignedTo, assignee: statusName === 'New' ? null : r.assignee } : r));
      showStatusToast(t('common.statusChangedTo', { id: requestId, status: statusName }), 'status', requestId);
    } catch (err) {
      showStatusToast(t('common.failedToUpdateStatus') + ': ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssign = async (e, requestId, developerId) => {
    e.stopPropagation();
    setShowAssignModal(null);
    setUpdatingId(`assign-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}`, { assignedTo: developerId || null });
      const dev = users.find(u => u.id === developerId);
      const newStatus = developerId ? statuses.find(s => s.name === 'Assigned') : statuses.find(s => s.name === 'New');
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assignedTo: developerId, assignee: dev || null, status: newStatus || r.status } : r));
      showStatusToast(t('common.assignedToName', { id: requestId, name: dev?.name || t('common.unassigned') }), 'assignment', requestId);
    } catch (err) {
      showStatusToast(t('common.failedToAssign') + ': ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClaim = async (e, requestId) => {
    e.stopPropagation();
    setUpdatingId(`claim-${requestId}`);
    try {
      await api.put(`/api/requests/${requestId}/claim`);
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, assignedTo: user.id, assignee: { id: user.id, name: user.name } } : r));
      showStatusToast(t('common.requestClaimed'), 'assignment', requestId);
    } catch (err) {
      showStatusToast(t('common.failedToClaim') + ': ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/requests/${id}`);
      setRequests(prev => prev.filter(r => r.id !== id));
      showStatusToast(t('common.requestDeleted'), 'success');
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast(t('common.failedToDeleteRequest') + ': ' + err.message, 'error');
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
        const str = (v) => (v === undefined || v === null) ? '' : String(v).toLowerCase();
        return [
          str(r.id),
          str(r.subject),
          str(r.description),
          str(r.status?.name),
          str(r.priority?.name),
          str(r.category?.name),
          str(r.client?.name),
          str(r.assignee?.name),
          str(r.assignedGroup?.name),
          ...(r.groups || []).map(g => str(g.name)),
          r.createdAt ? str(new Date(r.createdAt).toLocaleString()) : '',
          r.updatedAt ? str(new Date(r.updatedAt).toLocaleString()) : ''
        ].some(s => s.includes(q));
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

  const isReadOnly = (r) => {
    if (user?.role === 'support') {
      if (r.assignedTo === user.id) return false;
      if (r.status?.name === 'New') return true;
      return r.status?.name !== 'Escalated';
    }
    return r.assignedTo && r.assignedTo !== user.id;
  };

  const getQuickActions = (r) => {
    if (isReadOnly(r)) return [];
    const statusName = r.status?.name;
    const actions = [];

if (statusName === 'New') {
      actions.push({ label: t('common.claim'), status: 'Assigned', color: '#8B5CF6', icon: 'user', type: 'claim' });
      actions.push({ label: t('common.assign'), status: 'Assigned', color: '#8B5CF6', icon: 'users', type: 'assign' });
    }
    if (statusName === 'Assigned') {
      actions.push({ label: t('common.startWork'), status: 'In Progress', color: '#F59E0B', icon: 'play', type: 'status' });
    }
    if (statusName === 'In Progress') {
      actions.push({ label: t('common.waitingForClient'), status: 'Waiting for Client', color: '#F97316', icon: 'help', type: 'status' });
      actions.push({ label: t('common.escalate'), status: 'Escalated', color: '#EF4444', icon: 'alarm', type: 'status' });
    }
    if (statusName === 'Waiting for Client') {
      actions.push({ label: t('common.resolve'), status: 'Resolved', color: '#10B981', icon: 'check', type: 'status' });
    }
    if (statusName === 'Escalated') {
      if (r.assignedTo === user.id) {
        actions.push({ label: t('common.handle'), status: 'In Progress', color: '#F59E0B', icon: 'wrench', type: 'status' });
        actions.push({ label: t('common.resolve'), status: 'Resolved', color: '#10B981', icon: 'check', type: 'status' });
      } else {
        actions.push({ label: t('common.claim'), status: 'Escalated', color: '#8B5CF6', icon: 'user', type: 'claim' });
      }
    }
    return actions;
  };

  const DevStatCard = ({ icon, value, label, color, onClick }) => {
    return (
      <div className={`stat-card${onClick ? ' stat-card-interactive' : ''}`}
        style={{
          cursor: 'pointer',
          '--stat-accent': color,
          '--stat-shadow': `${color}30`
        }}
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
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('dashboard.escalationDashboard')}</h1>
          <p>{t('dashboard.escalationWelcome', { name: user?.name?.split(' ')[0] })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <RequestCalendar />
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '16px 20px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
          {error}
          <button onClick={() => { setError(''); loadData(); }} style={{ marginLeft: '12px', background: '#DC2626', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>{t('common.retry')}</button>
        </div>
      )}

      <div className="stats-grid">
        <DevStatCard icon={<Icon name="new" />} value={stats.newCount} label={t('common.new')} color="#3B82F6" onClick={() => setStatusFilter(statusFilter === 'New' ? '' : 'New')} />
        <DevStatCard icon={<Icon name="assigned" />} value={stats.assigned} label={t('common.assigned')} color="#8B5CF6" onClick={() => setStatusFilter(statusFilter === 'Assigned' ? '' : 'Assigned')} />
        <DevStatCard icon={<Icon name="inProgress" />} value={stats.inProgress} label={t('common.inProgress')} color="#F59E0B" onClick={() => setStatusFilter(statusFilter === 'In Progress' ? '' : 'In Progress')} />
        <DevStatCard icon={<Icon name="waiting" />} value={stats.waiting} label={t('common.awaitingClient')} color="#F97316" onClick={() => setStatusFilter(statusFilter === 'Waiting for Client' ? '' : 'Waiting for Client')} />
        <DevStatCard icon={<Icon name="escalated" />} value={stats.escalated} label={t('common.escalated')} color="#EF4444" onClick={() => setStatusFilter(statusFilter === 'Escalated' ? '' : 'Escalated')} />
        <DevStatCard icon={<Icon name="resolved" />} value={stats.resolved} label={t('common.resolved')} color="#10B981" onClick={() => setStatusFilter(statusFilter === 'Resolved' ? '' : 'Resolved')} />
        <DevStatCard icon={<Icon name="closed" />} value={stats.closed} label={t('common.closed')} color="#6B7280" onClick={() => setStatusFilter(statusFilter === 'Closed' ? '' : 'Closed')} />
        <DevStatCard icon={<Icon name="rejected" />} value={stats.rejected} label={t('common.rejected')} color="#DC2626" onClick={() => setStatusFilter(statusFilter === 'Rejected' ? '' : 'Rejected')} />
      </div>

      <div className="chart-card" style={{ marginTop: '24px' }}>
        <div className="table-header-bar">
          <span style={{ fontSize: '16px', fontWeight: 700 }}>{t('common.allRequestsCount', { count: filteredRequests.length })}</span>
          <div className="table-header-actions">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer', marginRight: '8px', userSelect: 'none' }}>
              <span>{t('common.showMyTasks')}</span>
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
              <option value="">{t('common.allStatuses')}</option>
              {statuses.filter(s => s.name !== 'Closed').map(s => <option key={s.id} value={s.name}>{transSeeded(s.name, 'status', t)}</option>)}
            </select>
            <select className="filter-select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}>
              <option value="">{t('common.allPriorities')}</option>
              <option value="Critical">{t('priority.Critical')}</option>
              <option value="High">{t('priority.High')}</option>
              <option value="Medium">{t('priority.Medium')}</option>
              <option value="Low">{t('priority.Low')}</option>
            </select>
            <div className="table-search-box">
              <span className="search-icon"><Icon name="search" size={14} /></span>
              <input type="text" placeholder={t('common.searchRequests')} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
            </div>
          </div>
        </div>

        <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable"><span onClick={() => handleSort('id')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.id')} {getSortIcon('id')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('subject')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.requestTitle')} {getSortIcon('subject')}</span></th>
                <th>{t('common.assignedTo')}</th>
                <th className="sortable"><span onClick={() => handleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.client')} {getSortIcon('client')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('groups')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.assignedGroup')} {getSortIcon('groups')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.category')} {getSortIcon('category')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('priority')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.priority')} {getSortIcon('priority')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('status')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.status')} {getSortIcon('status')}</span></th>
                <th className="sortable"><span onClick={() => handleSort('updatedAt')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.updated')} {getSortIcon('updatedAt')}</span></th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map(r => (
                <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row" style={isReadOnly(r) ? { opacity: 0.75 } : {}}>
                  <td><strong>{t('common.requestPrefixLabel')}{String(r.id).padStart(4, '0')}</strong></td>
                  <td><span className="truncate-cell">{r.subject}</span>{isReadOnly(r) && <span className="muted-text" style={{ marginLeft: 6, fontSize: 11, fontStyle: 'italic' }}>({t('common.readOnly')})</span>}</td>
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
                  <td>{r.clientDeleted ? <span className="muted-text">{t('common.clientDeleted')}</span> : <span className="truncate-cell">{r.client?.name || '-'}</span>}</td>
                  <td>
                    {r.groups && r.groups.length > 0
                      ? <span className="truncate-cell">{r.groups.map((g, i) => (
                          <span key={g.id} className="group-tag" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', marginRight: i < r.groups.length - 1 ? '4px' : 0 }}>
                            {g.name}
                          </span>
                        ))}</span>
                      : '-'}
                  </td>
                  <td><span className="truncate-cell"><span className="category-tag" style={{ background: (r.category?.color || '#3B82F6') + '20', color: r.category?.color || '#3B82F6' }}>{transSeeded(r.category?.name, 'category', t) || '-'}</span></span></td>
                  <td>
                    <span className="priority-badge" style={{ background: getPriorityColor(r.priority) + '20', color: getPriorityColor(r.priority) }}>
                      {transSeeded(r.priority?.name, 'priority', t) || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge" style={{ background: getStatusColor(r.status) + '20', color: getStatusColor(r.status) }}>
                      {transSeeded(r.status?.name, 'status', t) || '-'}
                    </span>
                  </td>
                  <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                  <td>
                    <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {getQuickActions(r).map((action, i) => (
                        action.type === 'claim' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            disabled={updatingId === `claim-${r.id}`}
                            onClick={(e) => handleClaim(e, r.id)}
                            style={{ opacity: updatingId === `claim-${r.id}` ? 0.6 : 1 }}
                          >
                            <Icon name={action.icon} size={14} /> {action.label}
                          </button>
                        ) : action.type === 'assign' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            onClick={() => setShowAssignModal(showAssignModal === r.id ? null : r.id)}
                          >
                            <Icon name={action.icon} size={14} /> {action.label}
                          </button>
                        ) : action.type === 'delete' ? (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text delete"
                            onClick={() => setDeleteTarget(r.id)}
                          >
                            <Icon name={action.icon} size={14} /> {action.label}
                          </button>
                        ) : (
                          <button
                            key={`q-${i}`}
                            className="action-btn-text edit"
                            disabled={updatingId === `status-${r.id}`}
                            onClick={(e) => handleQuickStatusUpdate(e, r.id, action.status)}
                            style={{ opacity: updatingId === `status-${r.id}` ? 0.6 : 1 }}
                          >
                            <Icon name={action.icon} size={14} /> {action.label}
                          </button>
                        )
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRequests.length === 0 && (
                <tr><td colSpan="10" className="muted-text" style={{ textAlign: 'center', padding: '24px' }}>
                  {displayRequests.length === 0 ? (showAssignedOnly ? t('common.noAssignedRequests') : t('common.noRequestsYet')) : t('common.noMatchFilters')}
                </td></tr>
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

      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
            <h3>{t('common.assignDeveloper')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
              <button
                onClick={(e) => handleAssign(e, showAssignModal, null)}
                style={{ textAlign: 'left', padding: '8px 12px', border: 'none', background: '#FEF3C7', color: '#D97706', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                {t('common.unassign')}
              </button>
              {developers.map(dev => (
                <button
                  key={dev.id}
                  onClick={(e) => handleAssign(e, showAssignModal, dev.id)}
                  style={{ textAlign: 'left', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px', color: '#374151' }}
                  onMouseOver={(e) => e.target.style.background = '#f3f4f6'}
                  onMouseOut={(e) => e.target.style.background = 'none'}
                >
                  {dev.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>{t('common.confirmDeleteRequest')}</p>
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

