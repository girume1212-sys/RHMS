import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
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

export default function Groups() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/groups'));
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [groups, setGroups] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6', company_id: '' });
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  const [memberGroup, setMemberGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [memberSort, setMemberSort] = useState({ key: '', dir: 'asc' });
  const [memberPage, setMemberPage] = useState(1);
  const [memberPerPage, setMemberPerPage] = useState(10);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { loadAll(); }, []);

  const loadAll = () => {
    setError('');
    setLoading(true);
    Promise.all([
      api.get('/api/groups'),
      api.get('/api/companies'),
      api.get('/api/users')
    ]).then(([groupsData, companiesData, usersData]) => {
      setGroups(groupsData.map((g, i) => ({ ...g, numId: i + 1 })));
      setCompanies(companiesData);
      setAllUsers(usersData);
      setLoading(false);
    }).catch(err => { setError(t('common.failedToLoadData') + ': ' + err.message); setLoading(false); });
  };

  const loadGroups = () => {
    api.get('/api/groups').then(data => { setGroups(data.map((g, i) => ({ ...g, numId: i + 1 }))); })
      .catch(err => { setError(t('common.failedToLoadGroups') + ': ' + err.message); });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const body = { name: form.name, description: form.description, color: form.color };
      if (form.company_id) body.company_id = form.company_id;
      await api.post('/api/groups', body);
      setShowModal(false);
      setForm({ name: '', description: '', color: '#3B82F6', company_id: '' });
      loadGroups();
      addToast(t('common.createdSuccess', { item: t('common.group') }));
      showStatusToast(t('common.groupCreatedWithName', { name: form.name }), 'request_created');
    } catch (err) {
      setError(t('common.failedToCreateGroup') + ': ' + err.message);
      addToast(t('common.failedToCreateGroup') + ': ' + err.message, 'error');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: form.name, description: form.description, color: form.color, company_id: form.company_id || null };
      await api.put(`/api/groups/${editingGroup.id}`, body);
      setEditingGroup(null);
      setForm({ name: '', description: '', color: '#3B82F6', company_id: '' });
      loadGroups();
      addToast(t('common.updatedSuccess', { item: t('common.group') }));
      showStatusToast(t('common.groupUpdatedWithName', { name: form.name }), 'status');
    } catch (err) {
      setError(t('common.failedToUpdateGroup') + ': ' + err.message);
      addToast(t('common.failedToUpdateGroup') + ': ' + err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await api.delete(`/api/groups/${id}`);
      loadGroups();
      addToast(t('common.groupDeletedWithName', { name }));
      showStatusToast(t('common.groupDeleted', { name }), 'request_deleted');
      setDeleteTarget(null);
    } catch (err) {
      setError(t('common.failedToDeleteGroup') + ': ' + err.message);
      addToast(t('common.failedToDeleteGroup') + ': ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setForm({
      name: group.name,
      description: group.description || '',
      color: group.color || '#3B82F6',
      company_id: group.company_id || ''
    });
    setShowModal(false);
  };

  const openCreate = () => {
    setEditingGroup(null);
    setForm({ name: '', description: '', color: '#3B82F6', company_id: '' });
    setShowModal(true);
  };

  const openMembers = async (group) => {
    setMemberGroup(group);
    setMembersLoading(true);
    setShowAddMember(false);
    setSelectedUserIds([]);
    setMemberSearch('');
    setAddMemberSearch('');
    try {
      const data = await api.get(`/api/groups/${group.id}/members`);
      setMembers(data);
    } catch (err) {
      addToast(t('common.failedToLoadMembers') + ': ' + err.message, 'error');
    }
    setMembersLoading(false);
  };

  const handleAddMember = async () => {
    if (!selectedUserIds.length) return;
    try {
      for (const uid of selectedUserIds) {
        await api.post(`/api/groups/${memberGroup.id}/members`, { user_id: uid });
      }
      setSelectedUserIds([]);
      setShowAddMember(false);
      const data = await api.get(`/api/groups/${memberGroup.id}/members`);
      setMembers(data);
      addToast(t('common.membersAdded', { count: selectedUserIds.length }));
      loadGroups();
    } catch (err) {
      addToast(t('common.failedToAddMember') + ': ' + err.message, 'error');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    try {
      await api.delete(`/api/groups/${memberGroup.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.id !== userId));
      addToast(t('common.memberRemovedFromGroup', { name: userName }));
      loadGroups();
      setRemoveTarget(null);
    } catch (err) {
      addToast(t('common.failedToRemoveMember') + ': ' + err.message, 'error');
      setRemoveTarget(null);
    }
  };

  const getNonMembers = () => {
    const memberIds = new Set(members.map(m => m.id));
    return allUsers.filter(u => !memberIds.has(u.id));
  };

  const getFilteredNonMembers = () => {
    const nonMembers = getNonMembers();
    if (!addMemberSearch) return nonMembers;
    const q = addMemberSearch.toLowerCase();
    return nonMembers.filter(u =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  };

  const filteredMembers = members.filter(m => {
    if (!memberSearch) return true;
    const q = memberSearch.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      (m.role || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (!memberSort.key) return 0;
    let aVal, bVal;
    switch (memberSort.key) {
      case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
      case 'email': aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); break;
      case 'role': aVal = (a.role || '').toLowerCase(); bVal = (b.role || '').toLowerCase(); break;
      default: return 0;
    }
    if (aVal < bVal) return memberSort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return memberSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleMemberSort = (key) => {
    setMemberSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const getMemberSortIcon = (key) => {
    const isActive = memberSort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleMemberSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleMemberSort(key); }}>{memberSort.dir === 'asc' ? '↑' : '↓'}</span>;
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

  const filteredGroups = groups.filter(g => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (g.name || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.company_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    if (!sort.key) return 0;
    let aVal, bVal;
    switch (sort.key) {
      case 'id': aVal = a.numId; bVal = b.numId; break;
      case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
      case 'company': aVal = (a.company_name || '').toLowerCase(); bVal = (b.company_name || '').toLowerCase(); break;
      case 'members': aVal = a.memberCount || 0; bVal = b.memberCount || 0; break;
      default: return 0;
    }
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredGroups.length / perPage);
  const paginated = filteredGroups.slice((page - 1) * perPage, page * perPage);

  const getRoleColor = (role) => {
    const colors = { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' };
    return colors[role] || '#6B7280';
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
          <h1>{t('sidebar.groups')}</h1>
          <p>{t('common.manageGroups')}</p>
        </div>
        {isAdmin && (<button className="btn btn-primary" onClick={openCreate}>+ {t('common.addGroup')}</button>)}
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="table-header-bar">
            <h3>{t('common.groupsCount', { count: filteredGroups.length })}</h3>
            <div className="table-header-actions">
              <div className="table-search-box">
                <span className="search-icon"><Icon name="search" size={14} /></span>
                <input type="text" placeholder={t('common.searchGroups')} value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px', cursor: 'pointer' }} onClick={() => handleSort('id')}><span>{t('common.id')} {getSortIcon('id')}</span></th>
                  <th className="sortable"><span>{t('common.group')} {getSortIcon('name')}</span></th>
                  <th className="sortable"><span>{t('common.company')} {getSortIcon('company')}</span></th>
                  <th className="sortable"><span>{t('common.members')} {getSortIcon('members')}</span></th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                  {paginated.map((g, index) => (
                    <tr key={g.id} onClick={() => openMembers(g)} className="clickable-row">
                    <td><span style={{ fontSize: '13px', fontWeight: '600' }}>{String(g.numId).padStart(2, '0')}</span></td>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm" style={{ background: g.color || '#6B7280' }}>{g.name.charAt(0)}</div>
                        <span className="truncate-cell">{g.name}</span>
                      </div>
                    </td>
                    <td><span className="truncate-cell">{g.company_name || <span style={{ color: '#9ca3af' }}>—</span>}</span></td>
                    <td>
                      <span className="role-badge" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280', cursor: 'pointer' }} onClick={() => openMembers(g)}>
                        {g.memberCount || 0}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell-inline">
                        {isAdmin && <button className="action-btn-text edit" onClick={(e) => { e.stopPropagation(); openEdit(g); }}>{t('common.edit')}</button>}
                        <button className="action-btn-text" style={{ color: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); openMembers(g); }}>{t('common.members')}</button>
                        {isAdmin && <button className="action-btn-text delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(g); }}>{t('common.delete')}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>{t('common.noGroupsFound')}</td></tr>
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
              <span>{t('common.ofGroups', { count: filteredGroups.length })}</span>
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

      {(showModal || editingGroup) && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingGroup(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingGroup ? t('common.editGroup') : t('common.addNewGroup')}</h2>
            <form onSubmit={editingGroup ? handleEdit : handleCreate}>
              <div className="form-group">
                <label>{t('common.groupName')}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('common.description')}</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('common.color')}</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: '100%', height: '42px', padding: '4px', borderRadius: '10px', border: '1px solid rgba(0,180,216,0.25)', cursor: 'pointer' }} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setEditingGroup(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? t('common.saveChanges') : t('common.createGroup')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberGroup && (
        <div className="modal-overlay" onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '14px' }}>
              <div className="modal-header-actions" style={{ justifyContent: 'flex-start' }}>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>← {t('common.back')}</button>
              </div>
              <div className="modal-header-content">
                <div className="modal-icon"><Icon name="users" size={22} /></div>
                <div>
                  <h2>{memberGroup.name} — {t('common.members')}</h2>
                  <p className="modal-subtitle">{t('common.memberCount', { count: members.length })}</p>
                </div>
              </div>
            </div>
              <div className="modal-body">
                {membersLoading ? (
                  <div className="loading-screen"><div className="spinner"></div></div>
                ) : (
                  <>
                    {isAdmin && (
                      <button className="btn btn-primary" style={{ marginBottom: '16px' }} onClick={() => setShowAddMember(prev => !prev)}>
                        {showAddMember ? `− ${t('common.cancel')}` : `+ ${t('common.addMember')}`}
                      </button>
                    )}
                    {showAddMember && (
                      <div className="add-member-panel">
                        {selectedUserIds.length > 0 && (
                          <div className="selected-members-list">
                            {selectedUserIds.map(id => {
                              const u = allUsers.find(u => u.id === Number(id));
                              return u ? (
                                <span key={id} className="selected-member-tag">
                                  {u.name}
                                  <button className="remove-tag-btn" onClick={() => setSelectedUserIds(prev => prev.filter(x => x !== id))}>&times;</button>
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                        <div className="table-search-box" style={{ marginBottom: '12px' }}>
                          <span className="search-icon"><Icon name="search" size={14} /></span>
                          <input type="text" placeholder={t('common.searchUsersToAdd')} value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} />
                        </div>
                        <div className="member-checkbox-list">
                          {getFilteredNonMembers().map(u => {
                            const sid = String(u.id);
                            const checked = selectedUserIds.includes(sid);
                            return (
                              <label key={u.id} className={`member-checkbox-row ${checked ? 'checked' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedUserIds(prev =>
                                      checked ? prev.filter(x => x !== sid) : [...prev, sid]
                                    );
                                  }}
                                />
                                <span className="member-checkbox-avatar" style={{ background: getRoleColor(u.role), overflow: 'hidden' }}>
                                  {getAvatarUrl(u.avatar) ? <img src={getAvatarUrl(u.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.name.charAt(0)}
                                </span>
                                <span className="member-checkbox-name">{u.name}</span>
                                <span className="member-checkbox-email">{u.email}</span>
                                <span className="member-checkbox-role" style={{ color: getRoleColor(u.role) }}>
                                  {u.role === 'support' ? t('role.escalationTeam') : t('role.' + u.role)}
                                </span>
                              </label>
                            );
                          })}
                          {getFilteredNonMembers().length === 0 && (
                            <div className="empty-state" style={{ marginTop: '8px' }}>{addMemberSearch ? t('common.noUsersMatching', { query: addMemberSearch }) : t('common.allUsersAlreadyMembers')}</div>
                          )}
                        </div>
                        <div className="add-member-actions">
                          <button className="btn btn-primary" onClick={handleAddMember} disabled={!selectedUserIds.length}>
                            {t('common.addSelected', { count: selectedUserIds.length })}
                          </button>
                          <button className="btn btn-outline" onClick={() => { setShowAddMember(false); setSelectedUserIds([]); }}>{t('common.cancel')}</button>
                        </div>
                      </div>
                    )}
                    {!showAddMember && members.length === 0 && (
                      <div className="empty-state">{t('common.noMembersInGroup')}</div>
                    )}
                    {!showAddMember && members.length > 0 && (
                      <>
                        <div className="table-search-box" style={{ marginBottom: '12px' }}>
                          <span className="search-icon"><Icon name="search" size={14} /></span>
                          <input type="text" placeholder={t('common.searchMembers')} value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} />
                        </div>
                        {filteredMembers.length === 0 ? (
                          <div className="empty-state">{t('common.noMembersMatching', { query: memberSearch })}</div>
                        ) : (
                      <div className="table-card" style={{ overflowX: 'hidden' }}>
            <table className="data-table">
                        <thead>
                          <tr>
                            <th className="sortable"><span>{t('common.user')} {getMemberSortIcon('name')}</span></th>
                            <th className="sortable"><span>{t('common.email')} {getMemberSortIcon('email')}</span></th>
                            <th className="sortable"><span>{t('common.role')} {getMemberSortIcon('role')}</span></th>
                            {isAdmin && <th style={{ width: '80px' }}>{t('common.actions')}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.slice((memberPage - 1) * memberPerPage, memberPage * memberPerPage).map(m => (
                            <tr key={m.id}>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar-sm" style={{ background: getRoleColor(m.role), overflow: 'hidden' }}>
                                    {getAvatarUrl(m.avatar) ? <img src={getAvatarUrl(m.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name.charAt(0)}
                                  </div>
                                  <span className="truncate-cell">{m.name}</span>
                                </div>
                              </td>
                              <td><span className="truncate-cell">{m.email}</span></td>
                              <td>
                                <span className="role-badge" style={{ background: getRoleColor(m.role) + '20', color: getRoleColor(m.role) }}>
                                  {m.role === 'support' ? t('role.escalationTeam') : t('role.' + m.role)}
                                </span>
                              </td>
                              <td>
                                {isAdmin && (
                                <button className="action-btn-text delete" onClick={() => setRemoveTarget(m)}>{t('common.remove')}</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredMembers.length > memberPerPage && (
                        <div className="table-footer">
                          <div className="table-footer-info">
                            <span>{t('common.show')}</span>
                            <select value={memberPerPage} onChange={(e) => { setMemberPerPage(Number(e.target.value)); setMemberPage(1); }}>
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                            </select>
                            <span>{t('common.of')} {filteredMembers.length} {t('common.members')}</span>
                          </div>
                          <div className="table-pagination">
                            <button className="page-btn" disabled={memberPage === 1} onClick={() => setMemberPage(1)}>«</button>
                            <button className="page-btn" disabled={memberPage === 1} onClick={() => setMemberPage(memberPage - 1)}>‹</button>
                            {Array.from({ length: Math.ceil(filteredMembers.length / memberPerPage) }, (_, i) => i + 1).map(p => (
                              <button key={p} className={`page-btn ${p === memberPage ? 'active' : ''}`} onClick={() => setMemberPage(p)}>{p}</button>
                            ))}
                            <button className="page-btn" disabled={memberPage === Math.ceil(filteredMembers.length / memberPerPage)} onClick={() => setMemberPage(memberPage + 1)}>›</button>
                            <button className="page-btn" disabled={memberPage === Math.ceil(filteredMembers.length / memberPerPage)} onClick={() => setMemberPage(Math.ceil(filteredMembers.length / memberPerPage))}>»</button>
                          </div>
                        </div>
                      )}
                    </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {removeTarget && (
        <div className="modal-overlay" onClick={() => setRemoveTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: '17px', lineHeight: 1.6, margin: '28px 24px 24px' }}>
              {t('common.confirmRemoveUser')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 28px' }}>
              <button className="btn btn-outline" onClick={() => setRemoveTarget(null)}
                style={{ padding: '10px 24px' }}>{t('common.cancel')}</button>
              <button onClick={() => handleRemoveMember(removeTarget.id, removeTarget.name)}
                style={{ padding: '10px 24px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                {t('common.remove')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: '17px', lineHeight: 1.6, margin: '28px 24px 24px' }}>
              {t('common.confirmDeleteGroup')}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 28px' }}>
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}
                style={{ padding: '10px 24px' }}>{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteTarget.id, deleteTarget.name)}
                style={{ padding: '10px 24px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
