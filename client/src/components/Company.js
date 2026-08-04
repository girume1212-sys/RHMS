import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';

export default function Company() {
  const { t } = useTranslation();
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
    }).catch(err => { setError(t('common.failedToLoadData') + ': ' + err.message); setLoading(false); });
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
      addToast(editingCompany ? t('common.updatedSuccess', { item: t('common.company') }) : t('common.createdSuccess', { item: t('common.company') }));
      showStatusToast(editingCompany ? t('company.updatedWithName', { name: form.name }) : t('company.createdWithName', { name: form.name }), 'status');
    } catch (err) {
      setError(t('company.failedToSave') + ': ' + err.message);
      addToast(t('company.failedToSave') + ': ' + err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('company.deleteConfirm'))) return;
    try {
      await api.delete(`/api/companies/${id}`);
      loadData();
      addToast(t('common.deletedSuccess', { item: t('common.company') }));
      showStatusToast(t('company.deleted'), 'request_deleted');
    } catch (err) {
      setError(t('company.failedToDelete') + ': ' + err.message);
      addToast(t('company.failedToDelete') + ': ' + err.message, 'error');
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
      addToast(t('common.updatedSuccess', { item: t('common.user') }));
      showStatusToast(t('company.userUpdated', { name: userForm.name }), 'status');
    } catch (err) {
      setError(t('company.failedToUpdateUser') + ': ' + err.message);
      addToast(t('company.failedToUpdateUser') + ': ' + err.message, 'error');
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(t('company.deleteUserConfirm', { name }))) return;
    try {
      await api.delete(`/api/users/${id}`);
      loadData();
      addToast(t('company.userDeletedWithName', { name }));
      showStatusToast(t('company.userDeleted', { name }), 'request_deleted');
    } catch (err) {
      setError(t('company.failedToDeleteUser') + ': ' + err.message);
      addToast(t('company.failedToDeleteUser') + ': ' + err.message, 'error');
    }
  };

  const getIndustryIcon = (industry) => {
    const icons = {
      'IT': 'code',
      'Healthcare': 'heart',
      'Finance': 'dollar',
      'Education': 'book',
      'Manufacturing': 'factory',
      'Retail': 'cart',
      'Other': 'company'
    };
    return icons[industry] || 'company';
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
          <button className="back-link" onClick={() => window.history.back()}>← {t('common.back')}</button>
          <h1>{t('sidebar.company')}</h1>
          <p>{t('company.manageSubtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>{t('company.addCompany')}</button>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal company-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon"><Icon name="company" size={22} /></div>
                <div>
                  <h2>{editingCompany ? t('company.editCompany') : t('company.addNewCompany')}</h2>
                  <p className="modal-subtitle">{editingCompany ? t('company.updateDetails') : t('company.fillDetails')}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-row-modal">
                <div className="form-group">
                  <label>{t('company.companyId')}</label>
                  <input
                    type="text"
                    value={form.companyId}
                    onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                    placeholder={t('company.companyIdPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('common.companyName')} <span className="required">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t('common.enterCompanyName')}
                  />
                </div>
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>{t('company.industry')}</label>
                  <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                    <option value="">{t('company.selectIndustry')}</option>
                    <option value="IT">{t('company.industryIT')}</option>
                    <option value="Healthcare">{t('company.industryHealthcare')}</option>
                    <option value="Finance">{t('company.industryFinance')}</option>
                    <option value="Education">{t('company.industryEducation')}</option>
                    <option value="Manufacturing">{t('company.industryManufacturing')}</option>
                    <option value="Retail">{t('company.industryRetail')}</option>
                    <option value="Other">{t('company.industryOther')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('company.companyType')}</label>
                  <select value={form.companyType} onChange={(e) => setForm({ ...form, companyType: e.target.value })}>
                    <option value="">{t('company.selectType')}</option>
                    <option value="Private">{t('company.typePrivate')}</option>
                    <option value="Public">{t('company.typePublic')}</option>
                    <option value="Startup">{t('company.typeStartup')}</option>
                    <option value="Government">{t('company.typeGovernment')}</option>
                    <option value="Non-Profit">{t('company.typeNonProfit')}</option>
                    <option value="Other">{t('company.typeOther')}</option>
                  </select>
                </div>
              </div>
              <div className="form-row-modal">
                <div className="form-group">
                  <label>{t('common.email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder={t('company.emailPlaceholder')}
                  />
                </div>
                <div className="form-group">
                  <label>{t('settings.phoneNumber')}</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder={t('company.phonePlaceholder')}
                  />
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSave}>{editingCompany ? t('company.updateCompany') : t('company.addCompanyButton')}</button>
            </div>
          </div>
        </div>
      )}

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="requests-by-category-card">
          <h3>{t('company.companiesCount', { count: companies.length })}</h3>
          <div className="category-cards-grid">
            {companies.map((c) => (
              <div key={c.id} className="category-manage-card" style={{ '--cat-color': getIndustryColor(c.industry), cursor: 'pointer' }} onClick={() => setSelectedCompany(c)}>
                <div className="category-manage-card-top">
                  <div className="category-manage-icon"><Icon name={getIndustryIcon(c.industry)} size={32} /></div>
                  <span className="category-manage-count">{t('company.usersCount', { count: getUserCount(c.name) })}</span>
                </div>
                <div className="category-manage-name">{c.name}</div>
                {c.company_id && <div className="category-manage-desc" style={{ fontSize: '11px', color: '#9ca3af' }}>{t('company.idLabel', { id: c.company_id })}</div>}
                {c.industry && <div className="category-manage-desc">{t('company.industryLabel', { industry: c.industry })}</div>}
                {c.company_type && <div className="category-manage-desc">{t('company.typeLabel', { type: c.company_type })}</div>}
                {c.email && <div className="category-manage-desc">{t('company.emailLabel', { email: c.email })}</div>}
                {c.phone && <div className="category-manage-desc">{t('company.phoneLabel', { phone: c.phone })}</div>}
                <div className="category-manage-actions">
                  <button className="category-view-btn" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>{t('common.edit')}</button>
                  <button className="category-view-btn" style={{ background: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}>{t('common.delete')}</button>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="empty-state">{t('company.noCompanies', { button: t('company.addCompany') })}</div>
            )}
          </div>
        </div>
      )}
      {selectedCompany && (
        <div className="modal-overlay" onClick={() => setSelectedCompany(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1100px' }}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon"><Icon name={getIndustryIcon(selectedCompany.industry)} size={22} /></div>
                <div>
                  <h2>{t('company.usersTitle', { name: selectedCompany.name })}</h2>
                  <p className="modal-subtitle">{t('company.usersInCompany', { count: getCompanyUsers(selectedCompany.name).length })}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedCompany(null)}>&times;</button>
            </div>
            <div className="modal-body">
              {getCompanyUsers(selectedCompany.name).length === 0 ? (
                <div className="empty-state">{t('company.noUsers')}</div>
              ) : (
                <div className="table-card" style={{ overflowX: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '70px' }}>{t('common.id')}</th>
                        <th>{t('common.user')}</th>
                        <th>{t('common.email')}</th>
                        <th>{t('common.role')}</th>
                        <th>{t('company.approved')}</th>
                        <th style={{ width: '150px' }}>{t('common.actions')}</th>
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
                              {u.role === 'support' ? t('role.escalationTeam') : u.role}
                            </span>
                          </td>
                          <td>{u.approved ? <span style={{ color: '#10B981' }}><Icon name="resolved" size={16} /></span> : <span style={{ color: '#EF4444' }}><Icon name="rejected" size={16} /></span>}</td>
                          <td>
                            <div className="actions-cell-inline">
                              <button className="action-btn-text edit" onClick={() => openEditUser(u)}>{t('common.edit')}</button>
                              <button className="action-btn-text delete" onClick={() => handleDeleteUser(u.id, u.name)}>{t('common.delete')}</button>
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
              <button className="btn btn-outline" onClick={() => setSelectedCompany(null)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon"><Icon name="edit" size={22} /></div>
                <div>
                  <h2>{t('common.editUser')}</h2>
                  <p className="modal-subtitle">{t('company.updateUserDetails', { name: editingUser.name })}</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setEditingUser(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t('common.fullName')}</label>
                <input type="text" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('common.email')}</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('company.newPasswordHint')}</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('common.role')}</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="client">{t('role.client')}</option>
                  <option value="support">{t('role.escalationTeam')}</option>
                  <option value="developer">{t('role.developer')}</option>
                  <option value="admin">{t('role.admin')}</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setEditingUser(null)}>{t('common.cancel')}</button>
              <button className="btn btn-primary" onClick={handleSaveUser}>{t('common.saveChanges')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
