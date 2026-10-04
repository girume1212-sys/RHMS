import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import PageNumbers from './PageNumbers';
import Icon from './Icon';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';
import { API_BASE } from '../api';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

export default function Users() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/users'));
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [blockTarget, setBlockTarget] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef(null);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    loadUsers();
    api.get('/api/groups').then(setGroups).catch(() => {});
    api.get('/api/companies').then(setCompanies).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target)) {
        setGroupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUsers = () => {
    setError('');
    setLoading(true);
    api.get('/api/users').then(data => { setUsers(data); setLoading(false); })
      .catch(err => { setError(t('common.failedToLoadUsers') + ': ' + err.message); setLoading(false); });
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

  const companyOptions = (() => {
    const fromDb = (Array.isArray(companies) ? companies : [])
      .map(c => c && c.name)
      .filter(Boolean);
    const fromUsers = users.map(u => u.companyName).filter(Boolean);
    return [...new Set([...fromDb, ...fromUsers])].sort((a, b) => a.localeCompare(b));
  })();

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (groupFilter && (!u.groupIds || !u.groupIds.includes(groupFilter))) return false;
    if (companyFilter && (u.companyName || '') !== companyFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q) ||
        (u.companyName || '').toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    if (!sort.key) return 0;
    let aVal, bVal;
    switch (sort.key) {
      case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
      case 'email': aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); break;
      case 'role': aVal = (a.role || '').toLowerCase(); bVal = (b.role || '').toLowerCase(); break;
      case 'group': aVal = (a.groupNames?.[0] || '').toLowerCase(); bVal = (b.groupNames?.[0] || '').toLowerCase(); break;
      case 'company': aVal = (a.companyName || '').toLowerCase(); bVal = (b.companyName || '').toLowerCase(); break;
      case 'createdAt': aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
      default: return 0;
    }
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredUsers.length / perPage);
  // Keep current page valid when page size / filters change.
  useEffect(() => {
    if (typeof totalPages === 'number' && totalPages > 0 && page > totalPages) setPage(totalPages);
    else if (typeof totalPages === 'number' && totalPages === 0 && page !== 1) setPage(1);
  }, [totalPages]);

  const paginated = filteredUsers.slice((page - 1) * perPage, page * perPage);

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const groupCounts = users.reduce((acc, u) => {
    if (u.groupIds && u.groupIds.length > 0) {
      u.groupIds.forEach(gid => {
        acc[gid] = (acc[gid] || 0) + 1;
      });
    }
    return acc;
  }, {});

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (form.password !== form.confirmPassword) {
        setError(t('validation.passwordMismatch'));
        addToast(t('validation.passwordMismatch'), 'error');
        return;
      }
      await api.post('/api/users', form);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
      loadUsers();
      addToast(t('common.createdSuccess', { item: t('common.user') }));
      showStatusToast(t('common.userCreatedWithName', { name: form.name }), 'request_created');
    } catch (err) {
      setError(t('common.failedToCreateUser') + ': ' + err.message);
      addToast(t('common.failedToCreateUser') + ': ' + err.message, 'error');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: form.name, email: form.email, companyName: form.companyName, role: form.role, groupIds: form.groupIds };
      if (form.password) body.password = form.password;
      await api.put(`/api/users/${editingUser.id}`, body);
      setEditingUser(null);
      setForm({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
      loadUsers();
      addToast(t('common.updatedSuccess', { item: t('common.user') }));
      showStatusToast(t('common.userUpdatedWithName', { name: form.name }), 'status');
    } catch (err) {
      setError(t('common.failedToUpdateUser') + ': ' + err.message);
      addToast(t('common.failedToUpdateUser') + ': ' + err.message, 'error');
    }
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', confirmPassword: '', companyName: user.companyName || '', role: user.role, groupIds: user.groupIds || [] });
    setShowModal(false);
  };

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/users/${id}`);
      loadUsers();
      addToast(t('common.userDeletedWithName', { name }));
      showStatusToast(t('common.userDeleted', { name }), 'request_deleted');
      setDeleteTarget(null);
    } catch (err) {
      setError(t('common.failedToDeleteUser') + ': ' + err.message);
      addToast(t('common.failedToDeleteUser') + ': ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const handleApprove = (id, name, approved) => {
    setBlockTarget({ id, name, approved });
  };

  const confirmBlock = async () => {
    const { id, name, approved } = blockTarget;
    setBlockTarget(null);
    try {
      await api.patch(`/api/users/${id}/approve`, { approved });
      loadUsers();
      addToast(approved ? t('common.userUnblocked', { name }) : t('common.userBlocked', { name }));
      showStatusToast(approved ? t('common.userUnblockedShort', { name }) : t('common.userBlockedShort', { name }), 'status');
    } catch (err) {
      setError((approved ? t('common.failedToUnblockUser') : t('common.failedToBlockUser')) + ': ' + err.message);
      addToast((approved ? t('common.failedToUnblockUser') : t('common.failedToBlockUser')) + ': ' + err.message, 'error');
    }
  };

  const getRoleColor = (role) => {
    const colors = { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' };
    return colors[role] || '#6B7280';
  };

  const openCreate = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
    setShowModal(true);
  };

  const getGroupName = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : null;
  };

  const getGroupColor = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    return group ? group.color : '#6B7280';
  };

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>← {t('common.back')}</button>
          <h1>{t('sidebar.users')}</h1>
          <p>{t('common.manageUsers')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ {t('common.addUser')}</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="filters-bar sf-toolbar">
            <div className="sf-toolbar-left">
              <div className="table-search-box">
                <span className="search-icon"><Icon name="search" size={14} /></span>
                <input
                  type="text"
                  placeholder={t('common.searchUsers')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="sf-toolbar-right">
              <select className="filter-select" value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
                <option value="">{t('common.allRoles')}</option>
                <option value="admin">{t('role.admin')}</option>
                <option value="support">{t('role.escalationTeam')}</option>
                <option value="developer">{t('role.developer')}</option>
                <option value="client">{t('role.client')}</option>
              </select>
              <select className="filter-select" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}>
                <option value="">{t('common.allGroups')}</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <select className="filter-select" value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1); }}>
                <option value="">{t('common.allCompanies')}</option>
                {companyOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-header-bar">
            <h3>{t('sidebar.users')} ({filteredUsers.length})</h3>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable"><span>{t('common.user')} {getSortIcon('name')}</span></th>
                  <th className="sortable"><span>{t('common.email')} {getSortIcon('email')}</span></th>
                  <th className="sortable"><span>{t('common.role')} {getSortIcon('role')}</span></th>
                  <th className="sortable"><span>{t('common.group')} {getSortIcon('group')}</span></th>
                  <th className="sortable"><span>{t('common.company')} {getSortIcon('company')}</span></th>
                  <th className="sortable"><span>{t('common.created')} {getSortIcon('createdAt')}</span></th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(u => (
                  <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => setViewingUser(u)}>
                    <td>
                      <div className="user-cell">
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div className="user-avatar-sm" style={{ background: getRoleColor(u.role), overflow: 'hidden' }}>
                              {getAvatarUrl(u.avatar) ? <img src={getAvatarUrl(u.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.name || 'U').charAt(0)}
                            </div>
                            {u.approved === false && u.role !== 'admin' && (
                              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e' }}>
                                <Icon name="lock" size={12} />
                              </div>
                            )}
                          </div>
                          <span className="truncate-cell">{u.name}</span>
                       </div>
                    </td>
                    <td><span className="truncate-cell">{u.email}</span></td>
                    <td><span className="role-badge" style={{ background: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>{t('role.' + u.role)}</span></td>
                    <td>
                      {u.groupNames && u.groupNames.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {u.groupNames.map((name, i) => (
                            <span key={i} className="role-badge" style={{ background: (u.groupColors[i] || '#6B7280') + '20', color: u.groupColors[i] || '#6B7280' }}>{name}</span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td><span className="truncate-cell">{u.companyName || <span style={{ color: '#9ca3af' }}>-</span>}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                        <div className="actions-cell-inline" onClick={(e) => e.stopPropagation()}>
                        {u.selfRegistered && u.role === 'client' && (
                          u.approved ? (
                            <button className="action-btn-text delete" onClick={() => handleApprove(u.id, u.name, false)}>{t('common.blockUser')}</button>
                          ) : (
                            <button className="action-btn-text edit" onClick={() => handleApprove(u.id, u.name, true)}>{t('common.unblockUser')}</button>
                          )
                        )}
                        <button className="action-btn-text edit" onClick={() => openEdit(u)}>{t('common.edit')}</button>
                        <button className="action-btn-text delete" onClick={() => setDeleteTarget({ id: u.id, name: u.name })}>{t('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>{t('common.noUsersFound')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="table-footer-info">
              <span>{t('common.show')}</span>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              <span>{t('common.of')} {filteredUsers.length} {t('sidebar.users')}</span>
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
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>{t('common.confirmDeleteUser')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteTarget.id, deleteTarget.name)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {blockTarget && (
        <div className="modal-overlay" onClick={() => setBlockTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>{blockTarget.approved ? t('common.confirmUnblockUser') : t('common.confirmBlockUser')}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setBlockTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button onClick={confirmBlock} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{blockTarget.approved ? t('common.unblockUser') : t('common.blockUser')}</button>
            </div>
          </div>
        </div>
      )}

      {viewingUser && (
        <div className="modal-overlay" onClick={() => setViewingUser(null)}>
          <div className="modal user-details-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '920px' }}>
            <h2>{t('common.userDetails')}</h2>
            <div className="user-details-grid">
              <div style={{
                background: 'linear-gradient(145deg, #2563EB 0%, #1E40AF 55%, #1E3A8A 100%)',
                borderRadius: '20px', padding: '32px', color: '#fff',
                boxShadow: '0 8px 32px rgba(30,58,138,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.18)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
              }}>
                <div style={{ marginBottom: '16px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 700, border: '4px solid rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                  {getAvatarUrl(viewingUser.avatar) ? <img src={getAvatarUrl(viewingUser.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (viewingUser.name || 'U').charAt(0)}
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 700 }}>{viewingUser.name}</h3>
                <p style={{ margin: '0 0 12px', opacity: 0.8, fontSize: '14px' }}>{viewingUser.email}</p>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, backdropFilter: 'blur(10px)' }}>
                  {t('role.' + viewingUser.role)}
                </div>
                <div style={{ marginTop: '20px', width: '100%', opacity: 0.9, fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                    <span>{t('common.company')}</span>
                    <span style={{ fontWeight: 600 }}>{viewingUser.companyName || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                    <span>{t('common.role')}</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t('role.' + viewingUser.role)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                    <span>{t('common.language')}</span>
                    <span style={{ fontWeight: 600 }}>{viewingUser.language || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span>{t('common.memberSince')}</span>
                    <span style={{ fontWeight: 600 }}>{viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="account-details-card">
                <h3 style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px' }}><Icon name="user" size={16} /></span>
                  {t('common.accountDetails')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[
                    { label: t('common.fullName'), value: viewingUser.name, icon: 'user', color: '#2563EB' },
                    { label: t('common.email'), value: viewingUser.email, icon: 'mail', color: '#0284c7' },
                    { label: t('common.company'), value: viewingUser.companyName || '-', icon: 'company', color: '#1e40af' },
                    { label: t('common.role'), value: t('role.' + viewingUser.role), icon: 'shield', color: '#3730a3' },
                    { label: t('common.group'), value: viewingUser.groupNames?.join(', ') || '-', icon: 'users', color: '#0e7490' },
                    { label: t('common.language'), value: viewingUser.language || '-', icon: 'globe', color: '#047857' },
                    { label: t('common.memberSince'), value: viewingUser.createdAt ? new Date(viewingUser.createdAt).toLocaleDateString() : '-', icon: 'calendar', color: '#1d4ed8' },
                    { label: t('common.status'), value: viewingUser.approved ? t('common.active') : t('common.blocked'), icon: viewingUser.approved ? 'check' : 'lock', color: viewingUser.approved ? '#059669' : '#DC2626' },
                  ].map((item, i) => (
                    <div key={i} className={i < 7 ? 'detail-divider' : ''} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: item.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}><Icon name={item.icon} size={18} /></div>
                      <div style={{ flex: 1 }}>
                        <div className="detail-label" style={{ fontSize: '12px', marginBottom: '2px' }}>{item.label}</div>
                        <div className="detail-value" style={{ fontSize: '14px', fontWeight: 500 }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setViewingUser(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {(showModal || editingUser) && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingUser(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? t('common.editUser') : t('common.addNewUser')}</h2>
            <form onSubmit={editingUser ? handleEdit : handleCreate}>
              <div className="form-group">
                <label>{t('common.userName')}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('common.email')}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('common.companyName')}</label>
                <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{editingUser ? t('common.newPassword') + ' (' + t('common.leaveBlank') + ')' : t('common.password')}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label>{t('common.confirmPassword')}</label>
                  <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label>{t('common.role')}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="client">{t('role.client')}</option>
                  <option value="support">{t('role.escalationTeam')}</option>
                  <option value="developer">{t('role.developer')}</option>
                  <option value="admin">{t('role.admin')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('common.group')}</label>
                <div className="multi-select-dropdown" ref={groupDropdownRef}>
                  <div className="multi-select-trigger" onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}>
                    <span className={`multi-select-value ${form.groupIds.length === 0 ? 'placeholder' : ''}`}>
                      {form.groupIds.length === 0
                        ? t('common.selectGroups')
                        : form.groupIds.map(id => groups.find(g => g.id === id)?.name || id).join(', ')}
                    </span>
                    <span className="multi-select-arrow">&#9662;</span>
                  </div>
                  {groupDropdownOpen && (
                    <div className="multi-select-options">
                      {groups.map(g => (
                        <div
                          key={g.id}
                          className={`multi-select-option ${form.groupIds.includes(g.id) ? 'selected' : ''}`}
                          onClick={() => {
                            if (form.groupIds.includes(g.id)) {
                              setForm({ ...form, groupIds: form.groupIds.filter(id => id !== g.id) });
                            } else {
                              setForm({ ...form, groupIds: [...form.groupIds, g.id] });
                            }
                          }}
                        >
                          {g.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setEditingUser(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingUser ? t('common.saveChanges') : t('common.createUser')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
