import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' });
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { loadGroups(); }, []);

  const loadGroups = () => {
    setError('');
    setLoading(true);
    api.get('/api/groups').then(data => { setGroups(data); setLoading(false); })
      .catch(err => { setError('Failed to load groups: ' + err.message); setLoading(false); });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/groups', form);
      setShowModal(false);
      setForm({ name: '', description: '', color: '#3B82F6' });
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
      await api.put(`/api/groups/${editingGroup.id}`, form);
      setEditingGroup(null);
      setForm({ name: '', description: '', color: '#3B82F6' });
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
    setForm({ name: group.name, description: group.description || '', color: group.color || '#3B82F6' });
    setShowModal(false);
  };

  const openCreate = () => {
    setEditingGroup(null);
    setForm({ name: '', description: '', color: '#3B82F6' });
    setShowModal(true);
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
        (g.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => {
    if (!sort.key) return 0;
    let aVal, bVal;
    switch (sort.key) {
      case 'name': aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase(); break;
      case 'description': aVal = (a.description || '').toLowerCase(); bVal = (b.description || '').toLowerCase(); break;
      case 'members': aVal = a.memberCount || 0; bVal = b.memberCount || 0; break;
      default: return 0;
    }
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filteredGroups.length / perPage);
  const paginated = filteredGroups.slice((page - 1) * perPage, page * perPage);

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
          <p>Manage user groups and departments</p>
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
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Search groups..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable">Group {getSortIcon('name')}</th>
                  <th className="sortable">Description {getSortIcon('description')}</th>
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
                    <td>{g.description || '-'}</td>
                    <td>
                      <span className="role-badge" style={{ background: (g.color || '#6B7280') + '20', color: g.color || '#6B7280' }}>
                        {g.memberCount || 0}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell-inline">
                        <button className="action-btn-text edit" onClick={() => openEdit(g)}>Edit</button>
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
    </div>
  );
}
