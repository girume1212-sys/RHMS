import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Groups() {
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
  const [selectedUserId, setSelectedUserId] = useState('');

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
      setGroups(groupsData);
      setCompanies(companiesData);
      setAllUsers(usersData);
      setLoading(false);
    }).catch(err => { setError('Failed to load data: ' + err.message); setLoading(false); });
  };

  const loadGroups = () => {
    api.get('/api/groups').then(data => { setGroups(data); })
      .catch(err => { setError('Failed to load groups: ' + err.message); });
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
      addToast('Group created successfully!');
      showStatusToast(`Group "${form.name}" created`, 'request_created');
    } catch (err) {
      setError('Failed to create group: ' + err.message);
      addToast('Failed to create group: ' + err.message, 'error');
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
      addToast('Group updated successfully!');
      showStatusToast(`Group "${form.name}" updated`, 'status');
    } catch (err) {
      setError('Failed to update group: ' + err.message);
      addToast('Failed to update group: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? Users in this group will be unassigned.`)) return;
    try {
      await api.delete(`/api/groups/${id}`);
      loadGroups();
      addToast(`Group "${name}" deleted successfully!`);
      showStatusToast(`Group "${name}" deleted`, 'request_deleted');
    } catch (err) {
      setError('Failed to delete group: ' + err.message);
      addToast('Failed to delete group: ' + err.message, 'error');
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
    setSelectedUserId('');
    try {
      const data = await api.get(`/api/groups/${group.id}/members`);
      setMembers(data);
    } catch (err) {
      addToast('Failed to load members: ' + err.message, 'error');
    }
    setMembersLoading(false);
  };

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    try {
      await api.post(`/api/groups/${memberGroup.id}/members`, { user_id: selectedUserId });
      setSelectedUserId('');
      const data = await api.get(`/api/groups/${memberGroup.id}/members`);
      setMembers(data);
      addToast('Member added successfully!');
      loadGroups();
    } catch (err) {
      addToast('Failed to add member: ' + err.message, 'error');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`Remove "${userName}" from this group?`)) return;
    try {
      await api.delete(`/api/groups/${memberGroup.id}/members/${userId}`);
      setMembers(prev => prev.filter(m => m.id !== userId));
      addToast(`"${userName}" removed from group`);
      loadGroups();
    } catch (err) {
      addToast('Failed to remove member: ' + err.message, 'error');
    }
  };

  const getNonMembers = () => {
    const memberIds = new Set(members.map(m => m.id));
    return allUsers.filter(u => !memberIds.has(u.id));
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
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Groups</h1>
          <p>Manage user groups and departments under companies</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Group</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="table-header-bar">
            <h3>Groups ({filteredGroups.length})</h3>
            <div className="table-header-actions">
              <div className="table-search-box">
                <span className="search-icon"></span>
                <input type="text" placeholder="Search groups..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">Group {getSortIcon('name')}</th>
                  <th className="sortable">Company {getSortIcon('company')}</th>
                  <th className="sortable">Members {getSortIcon('members')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(g => (
                  <tr key={g.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm" style={{ background: g.color || '#6B7280' }}>{g.name.charAt(0)}</div>
                        {g.name}
                      </div>
                    </td>
                    <td>{g.company_name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>
                      <span className="role-badge" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280' }}>
                        {g.memberCount || 0}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell-inline">
                        <button className="action-btn-text edit" onClick={() => openEdit(g)}>Edit</button>
                        <button className="action-btn-text" style={{ color: '#3B82F6' }} onClick={() => openMembers(g)}>Members</button>
                        <button className="action-btn-text delete" onClick={() => handleDelete(g.id, g.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No groups found</td></tr>
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
              <span>of {filteredGroups.length} groups</span>
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
      )}

      {(showModal || editingGroup) && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingGroup(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingGroup ? 'Edit Group' : 'Add New Group'}</h2>
            <form onSubmit={editingGroup ? handleEdit : handleCreate}>
              <div className="form-group">
                <label>Group Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Company</label>
                <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
                  <option value="">— No Company —</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: '100%', height: '42px', padding: '4px', borderRadius: '10px', border: '1px solid rgba(0,180,216,0.25)', cursor: 'pointer' }} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setEditingGroup(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingGroup ? 'Save Changes' : 'Create Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberGroup && (
        <div className="modal-overlay" onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">👥</div>
                <div>
                  <h2>{memberGroup.name} — Members</h2>
                  <p className="modal-subtitle">{members.length} member(s)</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>&times;</button>
            </div>
            <div className="modal-body">
              {membersLoading ? (
                <div className="loading-screen"><div className="spinner"></div></div>
              ) : (
                <>
                  {!showAddMember ? (
                    <button className="btn btn-primary" style={{ marginBottom: '16px' }} onClick={() => setShowAddMember(true)}>+ Add Member</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                      >
                        <option value="">Select a user...</option>
                        {getNonMembers().map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                      <button className="btn btn-primary" onClick={handleAddMember} disabled={!selectedUserId}>Add</button>
                      <button className="btn btn-outline" onClick={() => { setShowAddMember(false); setSelectedUserId(''); }}>Cancel</button>
                    </div>
                  )}
                  {members.length === 0 ? (
                    <div className="empty-state">No members in this group yet.</div>
                  ) : (
                    <div className="table-card" style={{ overflow: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th style={{ width: '80px' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map(m => (
                            <tr key={m.id}>
                              <td>
                                <div className="user-cell">
                                  <div className="user-avatar-sm" style={{ background: getRoleColor(m.role) }}>{m.name.charAt(0)}</div>
                                  {m.name}
                                </div>
                              </td>
                              <td>{m.email}</td>
                              <td>
                                <span className="role-badge" style={{ background: getRoleColor(m.role) + '20', color: getRoleColor(m.role) }}>
                                  {m.role === 'support' ? 'Escalation Team' : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                                </span>
                              </td>
                              <td>
                                <button className="action-btn-text delete" onClick={() => handleRemoveMember(m.id, m.name)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => { setMemberGroup(null); setShowAddMember(false); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
