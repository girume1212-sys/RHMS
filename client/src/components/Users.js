import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'client' });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = () => {
    api.get('/api/users').then(data => { setUsers(data); setLoading(false); });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post('/api/users', form);
    setShowModal(false);
    setForm({ name: '', email: '', password: '', role: 'client' });
    loadUsers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    await api.delete(`/api/users/${id}`);
    loadUsers();
  };

  const getRoleColor = (role) => {
    const colors = { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' };
    return colors[role] || '#6B7280';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p>Manage system users and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add User</button>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-sm" style={{ background: getRoleColor(u.role) }}>{u.name.charAt(0)}</div>
                    {u.name}
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className="role-badge" style={{ background: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>{u.role}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handleDelete(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add New User</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="client">Client</option>
                  <option value="support">Support</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
