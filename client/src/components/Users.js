import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [roleFilter, setRoleFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const groupDropdownRef = useRef(null);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [deleteTarget, setDeleteTarget] = useState(null);

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
      .catch(err => { setError('Failed to load users: ' + err.message); setLoading(false); });
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

  const filteredUsers = users.filter(u => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (groupFilter && (!u.groupIds || !u.groupIds.includes(groupFilter))) return false;
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
        setError('Passwords do not match');
        addToast('Passwords do not match', 'error');
        return;
      }
      await api.post('/api/users', form);
      setShowModal(false);
      setForm({ name: '', email: '', password: '', confirmPassword: '', companyName: '', role: 'client', groupIds: [] });
      loadUsers();
      addToast('User created successfully!');
      showStatusToast(`User "${form.name}" created`, 'request_created');
    } catch (err) {
      setError('Failed to create user: ' + err.message);
      addToast('Failed to create user: ' + err.message, 'error');
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
      addToast('User updated successfully!');
      showStatusToast(`User "${form.name}" updated`, 'status');
    } catch (err) {
      setError('Failed to update user: ' + err.message);
      addToast('Failed to update user: ' + err.message, 'error');
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
      addToast(`User "${name}" deleted successfully!`);
      showStatusToast(`User "${name}" deleted`, 'request_deleted');
      setDeleteTarget(null);
    } catch (err) {
      setError('Failed to delete user: ' + err.message);
      addToast('Failed to delete user: ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const handleApprove = async (id, name, approved) => {
    const action = approved ? 'approve' : 'unapprove';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      await api.patch(`/api/users/${id}/approve`, { approved });
      loadUsers();
      addToast(`User "${name}" ${action}d successfully!`);
      showStatusToast(`User "${name}" ${action}d`, 'status');
    } catch (err) {
      setError(`Failed to ${action} user: ` + err.message);
      addToast(`Failed to ${action} user: ` + err.message, 'error');
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
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Users</h1>
          <p>Manage system users and roles</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search users..."
          className="filter-search"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="support">Escalation Team</option>
          <option value="developer">Developer</option>
          <option value="client">Client</option>
        </select>
        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}>
          <option value="">All Groups</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="table-header-bar">
            <h3>Users ({filteredUsers.length})</h3>
            <div className="table-header-actions">
              <div className="table-search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search users..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">User {getSortIcon('name')}</th>
                  <th className="sortable">Email {getSortIcon('email')}</th>
                  <th className="sortable">Role {getSortIcon('role')}</th>
                  <th className="sortable">Group {getSortIcon('group')}</th>
                  <th className="sortable">Company {getSortIcon('company')}</th>
                  <th className="sortable">Created {getSortIcon('createdAt')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar-sm" style={{ background: getRoleColor(u.role) }}>{u.name.charAt(0)}</div>
                        {u.name}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className="role-badge" style={{ background: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>{u.role === 'support' ? 'Escalation Team' : u.role}</span></td>
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
                    <td>{u.companyName || <span style={{ color: '#9ca3af' }}>-</span>}</td>
                    <td>{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <div className="actions-cell-inline">
                        <button className="action-btn-text edit" onClick={() => openEdit(u)}>Edit</button>
                        <button className="action-btn-text delete" onClick={() => setDeleteTarget({ id: u.id, name: u.name })}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No users found</td></tr>
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
              <span>of {filteredUsers.length} users</span>
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

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center', background: '#1e293b' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>Are you sure you want to delete this user?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget.id, deleteTarget.name)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {(showModal || editingUser) && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setEditingUser(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
            <form onSubmit={editingUser ? handleEdit : handleCreate}>
              <div className="form-group">
                <label>User Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Company Name</label>
                <input type="text" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{editingUser ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} />
              </div>
              {!editingUser && (
                <div className="form-group">
                  <label>Confirm Password</label>
                  <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required />
                </div>
              )}
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="client">Client</option>
                  <option value="support">Escalation Team</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Group</label>
                <div className="multi-select-dropdown" ref={groupDropdownRef}>
                  <div className="multi-select-trigger" onClick={() => setGroupDropdownOpen(!groupDropdownOpen)}>
                    <span className={`multi-select-value ${form.groupIds.length === 0 ? 'placeholder' : ''}`}>
                      {form.groupIds.length === 0
                        ? 'Select groups...'
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
                <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); setEditingUser(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingUser ? 'Save Changes' : 'Create User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
