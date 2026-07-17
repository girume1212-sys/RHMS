import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Company() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'client' });
  const [toasts, setToasts] = useState([]);
  const [form, setForm] = useState({
    companyId: '',
    name: '',
    industry: '',
    companyType: '',
    email: '',
    phone: ''
  });

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    setError('');
    setLoading(true);
    Promise.all([
      api.get('/api/companies'),
      api.get('/api/users')
    ]).then(([companiesData, usersData]) => {
      setCompanies(companiesData);
      setUsers(usersData);
      setLoading(false);
    }).catch(err => { setError('Failed to load data: ' + err.message); setLoading(false); });
  };

  const openCreate = () => {
    setEditingCompany(null);
    setForm({ companyId: '', name: '', industry: '', companyType: '', email: '', phone: '' });
    setShowModal(true);
  };

  const openEdit = (company) => {
    setEditingCompany(company);
    setForm({
      companyId: company.company_id || '',
      name: company.name || '',
      industry: company.industry || '',
      companyType: company.company_type || '',
      email: company.email || '',
      phone: company.phone || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editingCompany) {
        await api.put(`/api/companies/${editingCompany.id}`, {
          companyId: form.companyId,
          name: form.name,
          industry: form.industry,
          companyType: form.companyType,
          email: form.email,
          phone: form.phone
        });
      } else {
        await api.post('/api/companies', {
          companyId: form.companyId,
          name: form.name,
          industry: form.industry,
          companyType: form.companyType,
          email: form.email,
          phone: form.phone
        });
      }
      setShowModal(false);
      loadData();
      addToast(editingCompany ? 'Company updated successfully!' : 'Company created successfully!');
      showStatusToast(editingCompany ? `Company "${form.name}" updated` : `Company "${form.name}" created`, 'status');
    } catch (err) {
      setError('Failed to save company: ' + err.message);
      addToast('Failed to save company: ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return;
    try {
      await api.delete(`/api/companies/${id}`);
      loadData();
      addToast('Company deleted successfully!');
      showStatusToast('Company deleted', 'request_deleted');
    } catch (err) {
      setError('Failed to delete company: ' + err.message);
      addToast('Failed to delete company: ' + err.message, 'error');
    }
  };

  const getUserCount = (companyName) => {
    return users.filter(u => (u.companyName || u.company_name) === companyName).length;
  };

  const getCompanyUsers = (companyName) => {
    return users.filter(u => (u.companyName || u.company_name) === companyName);
  };

  const getRoleColor = (role) => {
    const colors = { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' };
    return colors[role] || '#6B7280';
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ name: user.name, email: user.email, password: '', role: user.role });
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return;
    try {
      const body = { name: userForm.name, email: userForm.email, role: userForm.role };
      if (userForm.password) body.password = userForm.password;
      await api.put(`/api/users/${editingUser.id}`, body);
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '', role: 'client' });
      loadData();
      addToast('User updated successfully!');
      showStatusToast(`User "${userForm.name}" updated`, 'status');
    } catch (err) {
      setError('Failed to update user: ' + err.message);
      addToast('Failed to update user: ' + err.message, 'error');
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      loadData();
      addToast(`User "${name}" deleted successfully!`);
      showStatusToast(`User "${name}" deleted`, 'request_deleted');
    } catch (err) {
      setError('Failed to delete user: ' + err.message);
      addToast('Failed to delete user: ' + err.message, 'error');
    }
  };

  const getIndustryIcon = (industry) => {
    const icons = {
      'IT': '💻',
      'Healthcare': '🏥',
      'Finance': '💰',
      'Education': '📚',
      'Manufacturing': '🏭',
      'Retail': '🛒',
      'Other': '🏢'
    };
    return icons[industry] || '🏢';
  };

  const getIndustryColor = (industry) => {
    const colors = {
      'IT': '#3B82F6',
      'Healthcare': '#10B981',
      'Finance': '#F59E0B',
      'Education': '#8B5CF6',
      'Manufacturing': '#EF4444',
      'Retail': '#EC4899',
      'Other': '#6B7280'
    };
    return colors[industry] || '#0ea5e9';
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
          <h1>Company</h1>
          <p>Manage company assignments and overview</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Company</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal company-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">🏢</div>
                <div>
                  <h2>{editingCompany ? 'Edit Company' : 'Add New Company'}</h2>
                  <p className="modal-subtitle">{editingCompany ? 'Update company details' : 'Fill in the details below to add a new company'}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-row-modal">
                <div className="form-group">
                  <label>Company ID</label>
                  <input
                    type="text"
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    placeholder="e.g., COMP-001"
                  />
                </div>
                <div className="form-group">
                  <label>Company Name <span className="required">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>Industry</label>
                  <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                    <option value="">Select Industry</option>
                    <option value="IT">IT</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Finance">Finance</option>
                    <option value="Education">Education</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Retail">Retail</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Company Type</label>
                  <select value={form.companyType} onChange={(e) => setForm({ ...form, companyType: e.target.value })}>
                    <option value="">Select Type</option>
                    <option value="Private">Private</option>
                    <option value="Public">Public</option>
                    <option value="Startup">Startup</option>
                    <option value="Government">Government</option>
                    <option value="Non-Profit">Non-Profit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="company@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editingCompany ? 'Update Company' : 'Add Company'}</button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="requests-by-category-card">
          <h3>Companies ({companies.length})</h3>
          <div className="category-cards-grid">
            {companies.map((c) => (
              <div key={c.id} className="category-manage-card" style={{ '--cat-color': getIndustryColor(c.industry), cursor: 'pointer' }} onClick={() => setSelectedCompany(c)}>
                <div className="category-manage-card-top">
                  <div className="category-manage-icon">{getIndustryIcon(c.industry)}</div>
                  <span className="category-manage-count">{getUserCount(c.name)} users</span>
                </div>
                <div className="category-manage-name">{c.name}</div>
                {c.company_id && <div className="category-manage-desc" style={{ fontSize: '11px', color: '#9ca3af' }}>ID: {c.company_id}</div>}
                {c.industry && <div className="category-manage-desc">Industry: {c.industry}</div>}
                {c.company_type && <div className="category-manage-desc">Type: {c.company_type}</div>}
                {c.email && <div className="category-manage-desc">Email: {c.email}</div>}
                {c.phone && <div className="category-manage-desc">Phone: {c.phone}</div>}
                <div className="category-manage-actions">
                  <button className="category-view-btn" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>Edit</button>
                  <button className="category-view-btn" style={{ background: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>Delete</button>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="empty-state">No companies found. Click "+ Add Company" to create one.</div>
            )}
          </div>
        </div>
      )}
      {selectedCompany && (
        <div className="modal-overlay" onClick={() => setSelectedCompany(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">{getIndustryIcon(selectedCompany.industry)}</div>
                <div>
                  <h2>{selectedCompany.name} - Users</h2>
                  <p className="modal-subtitle">{getCompanyUsers(selectedCompany.name).length} user(s) in this company</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedCompany(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {getCompanyUsers(selectedCompany.name).length === 0 ? (
                <div className="empty-state">No users found for this company.</div>
              ) : (
                <div className="table-card" style={{ overflow: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>ID</th>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Approved</th>
                        <th style={{ width: '150px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCompanyUsers(selectedCompany.name).map((u, idx) => (
                        <tr key={u.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar-sm" style={{ background: getRoleColor(u.role) }}>
                                {u.name.charAt(0)}
                              </div>
                              {u.name}
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span className="role-badge" style={{ background: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>
                              {u.role === 'support' ? 'Escalation Team' : u.role}
                            </span>
                          </td>
                          <td>{u.approved ? '✅' : '❌'}</td>
                          <td>
                            <div className="actions-cell-inline">
                              <button className="action-btn-text edit" onClick={() => openEditUser(u)}>Edit</button>
                              <button className="action-btn-text delete" onClick={() => handleDeleteUser(u.id, u.name)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSelectedCompany(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon">✏️</div>
                <div>
                  <h2>Edit User</h2>
                  <p className="modal-subtitle">Update user details for {editingUser.name}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditingUser(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>New Password (leave blank to keep)</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="client">Client</option>
                  <option value="support">Escalation Team</option>
                  <option value="developer">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditingUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveUser}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
