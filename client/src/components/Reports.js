import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';
import PageNumbers from './PageNumbers';
import Icon from './Icon';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

export default function Reports() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/reports'));
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [tasksPage, setTasksPage] = useState(1);
  const [tasksPerPage, setTasksPerPage] = useState(10);
  const [perfPage, setPerfPage] = useState(1);
  const [perfPerPage, setPerfPerPage] = useState(10);
  const [tasksSort, setTasksSort] = useState({ key: '', dir: 'asc' });
  const [perfSort, setPerfSort] = useState({ key: '', dir: 'asc' });
  const [perfSearch, setPerfSearch] = useState('');
  const [perfRole, setPerfRole] = useState('');
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

  const filteredPerf = (report.userPerformance || []).filter(u => {
    if (perfRole && u.role !== perfRole) return false;
    if (!perfSearch.trim()) return true;
    return (u.name || '').toLowerCase().includes(perfSearch.trim().toLowerCase());
  });

  const sortedPerf = [...filteredPerf].sort((a, b) => {
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
      showStatusToast(t('common.requestDeletedWithId', { id }), 'request_deleted', id);
      setDeleteTarget(null);
    } catch (err) {
      showStatusToast(t('common.failedToDelete', { item: t('common.request') }), 'error');
      setDeleteTarget(null);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('sidebar.reportsAnalytics')}</h1>
          <p>{t('dashboard.reportsSubtitle')}</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card-simple"><h3>{report.total}</h3><p>{t('common.totalRequests')}</p></div>
        <div className="stat-card-simple"><h3>{report.totalUsers}</h3><p>{t('dashboard.totalUsers')}</p></div>
        <div className="stat-card-simple"><h3>{report.avgResolutionTime}</h3><p>{t('dashboard.avgResolutionTime')}</p></div>
        <div className="stat-card-simple"><h3>{report.clientSatisfaction}</h3><p>{t('dashboard.clientSatisfaction')}</p></div>
      </div>

      <div className="charts-row-2">
        <div className="chart-card">
          <h3>{t('dashboard.requestsByStatus')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byStatus || []).map(s => ({ ...s, name: transSeeded(s.name, 'status', t), count: Number(s.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>{t('dashboard.requestsByPriority')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byPriority || []).map(p => ({ ...p, name: transSeeded(p.name, 'priority', t), count: Number(p.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-row-2">
        <div className="chart-card">
          <h3>{t('dashboard.requestsByCompany')}</h3>
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
        <div className="chart-card">
          <h3>{t('dashboard.requestsByCategory')}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={(report.byCategory || []).map(c => ({ ...c, name: transSeeded(c.name, 'category', t), count: Number(c.count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card wide">
          <h3>{t('dashboard.newTasksLatest')}</h3>
          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable"><span>{t('common.id')} {getTasksSortIcon('id')}</span></th>
                  <th className="sortable"><span>{t('common.requestTitle')} {getTasksSortIcon('subject')}</span></th>
                  <th className="sortable"><span>{t('common.client')} {getTasksSortIcon('client')}</span></th>
                  <th className="sortable"><span>{t('common.category')} {getTasksSortIcon('category')}</span></th>
                  <th className="sortable"><span>{t('common.priority')} {getTasksSortIcon('priority')}</span></th>
                  <th className="sortable"><span>{t('common.created')} {getTasksSortIcon('created')}</span></th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTasks.map(r => (
                  <tr key={r.id} onClick={() => navigate(`/requests/${r.id}`)} className="clickable-row">
                    <td><strong>REQ-{String(r.id).padStart(4, '0')}</strong></td>
                    <td><span className="truncate-cell">{r.subject}</span></td>
                    <td>
                      {r.client_deleted ? (
                        <span className="muted-text">{t('common.clientDeleted')}</span>
                      ) : (
                        <div className="assigned-user-cell">
                          <div className="assigned-avatar" style={{ background: '#10B981', overflow: 'hidden' }}>
                            {getAvatarUrl(r.client_avatar) ? <img src={getAvatarUrl(r.client_avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ((r.client_name || '?').charAt(0))}
                          </div>
                          <span className="truncate-cell">{r.client_name || '-'}</span>
                        </div>
                      )}
                    </td>
                    <td><span className="truncate-cell"><span className="category-tag" style={{ background: (r.category_color || '#3B82F6') + '20', color: r.category_color || '#3B82F6' }}>{r.category_name || '-'}</span></span></td>
                    <td><span className="truncate-cell"><span className="priority-badge">{r.priority_name || '-'}</span></span></td>
                    <td>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                      {r.status_name === 'New' ? (
                        <>
                          <button className="action-btn-text edit" onClick={() => navigate(`/requests/${r.id}?edit=true`)}>{t('common.edit')}</button>
                          <button className="action-btn-text delete" onClick={() => setDeleteTarget(r.id)}>{t('common.delete')}</button>
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>—</span>
                      )}
                    </div>
                    </td>
                  </tr>
                ))}
                {paginatedTasks.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>{t('common.noTasksFound')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <div className="table-footer-info">
              <span>{t('common.show')}</span>
              <select value={tasksPerPage} onChange={(e) => { setTasksPerPage(Number(e.target.value)); setTasksPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>{t('common.ofTasks', { count: sortedTasks.length })}</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={tasksPage === 1} onClick={() => setTasksPage(1)}>«</button>
              <button className="page-btn" disabled={tasksPage === 1} onClick={() => setTasksPage(tasksPage - 1)}>‹</button>
              <PageNumbers page={tasksPage} totalPages={tasksTotalPages} onPageChange={setTasksPage} />
              <button className="page-btn" disabled={tasksPage === tasksTotalPages || tasksTotalPages === 0} onClick={() => setTasksPage(tasksPage + 1)}>›</button>
              <button className="page-btn" disabled={tasksPage === tasksTotalPages || tasksTotalPages === 0} onClick={() => setTasksPage(tasksTotalPages)}>»</button>
            </div>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="chart-card wide">
          <h3>{t('dashboard.teamPerformance')}</h3>
          <div className="filters-bar sf-toolbar">
            <div className="sf-toolbar-left">
              <div className="table-search-box">
                <span className="search-icon"><Icon name="search" size={14} /></span>
                <input
                  type="text"
                  placeholder={t('common.searchUsers')}
                  value={perfSearch}
                  onChange={(e) => { setPerfSearch(e.target.value); setPerfPage(1); }}
                />
              </div>
            </div>
            <div className="sf-toolbar-right">
              <select className="filter-select" value={perfRole} onChange={(e) => { setPerfRole(e.target.value); setPerfPage(1); }}>
                <option value="">{t('common.allRoles')}</option>
                <option value="support">{t('role.escalationTeam')}</option>
                <option value="developer">{t('role.developer')}</option>
              </select>
            </div>
          </div>
          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable"><span onClick={() => handlePerfSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.user')} {getPerfSortIcon('name')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('role')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.role')} {getPerfSortIcon('role')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('total')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('dashboard.totalAssigned')} {getPerfSortIcon('total')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('resolved')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.resolved')} {getPerfSortIcon('resolved')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('inProgress')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.inProgress')} {getPerfSortIcon('inProgress')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('pending')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('common.pending')} {getPerfSortIcon('pending')}</span></th>
                  <th className="sortable"><span onClick={() => handlePerfSort('rate')} style={{ cursor: 'pointer', userSelect: 'none' }}>{t('dashboard.resolutionRate')} {getPerfSortIcon('rate')}</span></th>
                </tr>
              </thead>
              <tbody>
                {paginatedPerf.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="assigned-user-cell">
                        <div className="assigned-avatar" style={{ background: u.role === 'developer' ? '#8B5CF6' : '#3B82F6', overflow: 'hidden' }}>{getAvatarUrl(u.avatar) ? <img src={getAvatarUrl(u.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name.charAt(0)}</div>
                        <span className="truncate-cell">{u.name}</span>
                      </div>
                    </td>
                    <td><span className="role-badge" style={{ background: u.role === 'developer' ? '#8B5CF620' : '#3B82F620', color: u.role === 'developer' ? '#8B5CF6' : '#3B82F6' }}>{u.role === 'developer' ? t('role.developer') : t('role.escalationTeam')}</span></td>
                    <td>{u.total_assigned}</td>
                    <td style={{ color: '#10B981' }}>{u.resolved}</td>
                    <td style={{ color: '#F59E0B' }}>{u.in_progress}</td>
                    <td style={{ color: '#EF4444' }}>{u.pending}</td>
                    <td>{u.total_assigned > 0 ? Math.round((u.resolved / u.total_assigned) * 100) : 0}%</td>
                  </tr>
                ))}
                {paginatedPerf.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>{t('dashboard.noPerformanceData')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <div className="table-footer-info">
              <span>{t('common.show')}</span>
              <select value={perfPerPage} onChange={(e) => { setPerfPerPage(Number(e.target.value)); setPerfPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>{t('common.ofUsers', { count: sortedPerf.length })}</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={perfPage === 1} onClick={() => setPerfPage(1)}>«</button>
              <button className="page-btn" disabled={perfPage === 1} onClick={() => setPerfPage(perfPage - 1)}>‹</button>
              <PageNumbers page={perfPage} totalPages={perfTotalPages} onPageChange={setPerfPage} />
              <button className="page-btn" disabled={perfPage === perfTotalPages || perfTotalPages === 0} onClick={() => setPerfPage(perfPage + 1)}>›</button>
              <button className="page-btn" disabled={perfPage === perfTotalPages || perfTotalPages === 0} onClick={() => setPerfPage(perfTotalPages)}>»</button>
            </div>
          </div>
        </div>
      </div>

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
