import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useTranslation } from '../i18n/useTranslation';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { getMenuAbove, useBackNavigation } from '../utils/sidebarNav';
import { cropLogoImage } from '../utils/logoCrop';

const TIMEZONES = [
  'Africa/Addis_Ababa', 'Africa/Nairobi', 'Africa/Cairo', 'Africa/Lagos',
  'Africa/Johannesburg', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh',
  'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC'
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'አማርኛ (Amharic)' },
];

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

const FILE_TYPE_OPTIONS = ['jpg', 'png', 'gif', 'svg', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'mp4', 'csv'];

export default function Settings() {
  const navigate = useNavigate();
  const goBack = useBackNavigation(getMenuAbove('/settings'));
  const { applyTheme } = useAuth();
  const { changeLanguage } = useLanguage();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const logoInputRef = useRef(null);
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);

  const initialForm = {
    systemName: 'RHMS Support System',
    companyName: '',
    systemEmail: '',
    requestPrefix: 'REQ',
    phoneNumber: '',
    address: '',
    timeZone: 'Africa/Addis_Ababa',
    language: 'en',
    defaultStatus: '',
    defaultPriority: '',
    autoRequestId: true,
    maxFileSize: 10,
    allowedFileTypes: '',
    allowReopen: true,
    emailNotifications: true,
    inAppNotifications: true,
    notifyClientStatusChange: true,
    notifyDeveloperAssignment: true,
    autoAssign: false,
    soundAlerts: true,
    desktopNotifications: true,
    passwordLength: 8,
    passwordExpiry: 90,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    twoFactorAuth: false,
    theme: 'partial',
    accentColor: '#00b4d8',
    sidebarStyle: 'comfortable',
    assignmentMode: 'group-based',
    defaultGroup: '',
    maintenanceMode: false,
    responseHours: 4,
    resolutionHours: 48,
    escalationEnabled: true,
    workStart: '09:00',
    workEnd: '17:00',
    weekendDays: '',
    holidaysEnabled: true,
    autoBackup: false,
    backupFrequency: 'weekly',
    systemLogo: '',
    createRequestEnabled: false,
  };

  const [form, setForm] = useState({ ...initialForm });

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const [statusModal, setStatusModal] = useState(null);
  const [showStatusManagement, setShowStatusManagement] = useState(true);
  const [editingStatus, setEditingStatus] = useState(null);
  const [statusForm, setStatusForm] = useState({ name: '', color: '#6B7280' });
  const [statusSaving, setStatusSaving] = useState(false);
  const [allStatuses, setAllStatuses] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/settings'),
      api.get('/api/companies'),
      api.get('/api/groups'),
      api.get('/api/statuses/all'),
      api.get('/api/priorities'),
    ]).then(([settingsData, companiesData, groupsData, statusesData, prioritiesData]) => {
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setAllStatuses(Array.isArray(statusesData) ? statusesData : []);
      setStatuses(Array.isArray(statusesData) ? statusesData.filter(s => s.is_active !== false) : []);
      setPriorities(Array.isArray(prioritiesData) ? prioritiesData : []);
      setForm(prev => {
        const merged = { ...prev, ...settingsData };
        const boolKeys = [
          'autoRequestId', 'allowReopen', 'emailNotifications', 'inAppNotifications',
          'notifyClientStatusChange', 'notifyDeveloperAssignment', 'autoAssign',
          'soundAlerts', 'desktopNotifications', 'twoFactorAuth', 'maintenanceMode',
          'escalationEnabled', 'holidaysEnabled', 'autoBackup', 'createRequestEnabled'
        ];
        const numKeys = [
          'maxFileSize', 'passwordLength', 'passwordExpiry', 'sessionTimeout',
          'maxLoginAttempts', 'responseHours', 'resolutionHours'
        ];
        for (const key of boolKeys) {
          if (typeof merged[key] === 'string') merged[key] = merged[key] === 'true';
        }
        for (const key of numKeys) {
          if (typeof merged[key] === 'string') merged[key] = Number(merged[key]);
        }
        return merged;
      });
    }).catch(err => {
      addToast(t('common.failedToLoadSettings'), 'error');
    }).finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleArrayToggle = (key, item) => {
    setForm(prev => {
      const arr = [...(prev[key] || [])];
      const idx = arr.indexOf(item);
      if (idx === -1) arr.push(item);
      else arr.splice(idx, 1);
      return { ...prev, [key]: arr };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/settings', {
        systemName: form.systemName,
        companyName: form.companyName,
        systemEmail: form.systemEmail,
        requestPrefix: form.requestPrefix,
        phoneNumber: form.phoneNumber,
        address: form.address,
        timeZone: form.timeZone,
        language: form.language,
        defaultStatus: String(form.defaultStatus || ''),
        defaultPriority: String(form.defaultPriority || ''),
        autoRequestId: String(form.autoRequestId),
        maxFileSize: String(form.maxFileSize),
        allowedFileTypes: form.allowedFileTypes || '',
        allowReopen: String(form.allowReopen),
        emailNotifications: String(form.emailNotifications),
        inAppNotifications: String(form.inAppNotifications),
        notifyClientStatusChange: String(form.notifyClientStatusChange),
        notifyDeveloperAssignment: String(form.notifyDeveloperAssignment),
        autoAssign: String(form.autoAssign),
        soundAlerts: String(form.soundAlerts),
        desktopNotifications: String(form.desktopNotifications),
        passwordLength: String(form.passwordLength),
        passwordExpiry: String(form.passwordExpiry),
        sessionTimeout: String(form.sessionTimeout),
        maxLoginAttempts: String(form.maxLoginAttempts),
        twoFactorAuth: String(form.twoFactorAuth),
        theme: form.theme,
        accentColor: form.accentColor,
        sidebarStyle: form.sidebarStyle,
        assignmentMode: form.assignmentMode,
        defaultGroup: form.defaultGroup || '',
        maintenanceMode: String(form.maintenanceMode),
        responseHours: String(form.responseHours),
        resolutionHours: String(form.resolutionHours),
        escalationEnabled: String(form.escalationEnabled),
        workStart: form.workStart,
        workEnd: form.workEnd,
        weekendDays: form.weekendDays || '',
        holidaysEnabled: String(form.holidaysEnabled),
        autoBackup: String(form.autoBackup),
        backupFrequency: form.backupFrequency,
        createRequestEnabled: String(form.createRequestEnabled),
      });
      applyTheme(form.theme);
      if (form.language) changeLanguage(form.language);
      addToast(t('settings.saved'));
      showStatusToast(t('settings.saved'), 'status');
    } catch (err) {
      addToast(t('settings.saveFailed') + ': ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(t('settings.resetConfirm'))) return;
    setSaving(true);
    try {
      await api.post('/api/settings/reset');
      setForm({ ...initialForm });
      addToast(t('settings.resetDone'));
      showStatusToast(t('settings.resetDone'), 'status');
    } catch (err) {
      addToast(t('common.failedToSave').replace('{item}', t('settings.title')) + ': ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openStatusModal = (status = null) => {
    setEditingStatus(status);
    setStatusForm(status ? { name: status.name, color: status.color } : { name: '', color: '#6B7280' });
    setStatusModal(true);
  };

  const closeStatusModal = () => {
    setStatusModal(false);
    setEditingStatus(null);
    setStatusForm({ name: '', color: '#6B7280' });
  };

  const handleStatusSave = async () => {
    const trimmedName = statusForm.name.trim();
    if (!trimmedName) {
      addToast('Status name is required', 'error');
      return;
    }
    setStatusSaving(true);
    try {
      if (editingStatus) {
        await api.put(`/api/statuses/${editingStatus.id}`, { name: trimmedName, color: statusForm.color });
        addToast('Status updated successfully');
      } else {
        await api.post('/api/statuses', { name: trimmedName, color: statusForm.color });
        addToast('Status created successfully');
      }
      const refreshed = await api.get('/api/statuses/all');
      setAllStatuses(Array.isArray(refreshed) ? refreshed : []);
      setStatuses(Array.isArray(refreshed) ? refreshed.filter(s => s.is_active !== false) : []);
      closeStatusModal();
    } catch (err) {
      addToast(err.message || 'Failed to save status', 'error');
    } finally {
      setStatusSaving(false);
    }
  };

  const [statusDeleteTarget, setStatusDeleteTarget] = useState(null);

  const handleStatusDelete = (status) => {
    if (status.is_system) {
      addToast('System statuses cannot be deleted', 'error');
      return;
    }
    setStatusDeleteTarget(status);
  };

  const confirmStatusDelete = async () => {
    const status = statusDeleteTarget;
    setStatusDeleteTarget(null);
    try {
      await api.delete(`/api/statuses/${status.id}`);
      addToast('Status deleted successfully');
      const refreshed = await api.get('/api/statuses/all');
      setAllStatuses(Array.isArray(refreshed) ? refreshed : []);
      setStatuses(Array.isArray(refreshed) ? refreshed.filter(s => s.is_active !== false) : []);
    } catch (err) {
      addToast(err.message || 'Failed to delete status', 'error');
    }
  };

  const handleStatusToggle = async (status) => {
    try {
      await api.patch(`/api/statuses/${status.id}/toggle`);
      const refreshed = await api.get('/api/statuses/all');
      setAllStatuses(Array.isArray(refreshed) ? refreshed : []);
      setStatuses(Array.isArray(refreshed) ? refreshed.filter(s => s.is_active !== false) : []);
    } catch (err) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleStatusReorder = async (orderedIds) => {
    try {
      await api.patch('/api/statuses/reorder', { orderedIds });
      const refreshed = await api.get('/api/statuses/all');
      setAllStatuses(Array.isArray(refreshed) ? refreshed : []);
      setStatuses(Array.isArray(refreshed) ? refreshed.filter(s => s.is_active !== false) : []);
    } catch (err) {
      addToast(err.message || 'Failed to reorder statuses', 'error');
    }
  };

  const moveStatus = (index, direction) => {
    const newOrder = [...allStatuses];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= newOrder.length) return;
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setAllStatuses(newOrder);
    handleStatusReorder(newOrder.map(s => s.id));
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="page-container">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="page-header">
        <div>
          <button className="back-link" onClick={goBack}>{t('common.back')}</button>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings-page">
        {/* General */}
        <div className="settings-card">
          <h3>{t('settings.general')}</h3>
          <div className="settings-field">
            <label>{t('settings.systemName')}</label>
            <input type="text" value={form.systemName} onChange={e => handleChange('systemName', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.companyName')}</label>
            <select value={form.companyName} onChange={e => handleChange('companyName', e.target.value)}>
              <option value="">{t('settings.selectCompany')}</option>
              {companies.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.supportEmail')}</label>
            <input type="email" value={form.systemEmail} onChange={e => handleChange('systemEmail', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.requestPrefix')}</label>
            <input type="text" value={form.requestPrefix} onChange={e => handleChange('requestPrefix', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.phoneNumber')}</label>
            <input type="text" value={form.phoneNumber} onChange={e => handleChange('phoneNumber', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.address')}</label>
            <input type="text" value={form.address} onChange={e => handleChange('address', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.language')} - {t('settings.timeZone')}</label>
            <select value={form.timeZone} onChange={e => handleChange('timeZone', e.target.value)}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.language')}</label>
            <select value={form.language} onChange={e => handleChange('language', e.target.value)}>
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.systemLogo')}</label>
            <div className="logo-upload-area">
              {form.systemLogo || logoPreview ? (
                <div className="logo-preview">
                  <img src={logoPreview || `${API_BASE}${form.systemLogo}`} alt="Logo" />
                  <button type="button" className="logo-remove-btn" onClick={async () => {
                    try {
                      await api.delete('/api/settings/logo');
                      handleChange('systemLogo', '');
                      setLogoPreview(null);
                      addToast(t('settings.logoRemoved'), 'success');
                    } catch { addToast(t('settings.logoRemoveFailed'), 'error'); }
                  }}>&times;</button>
                </div>
              ) : (
                <div className="logo-placeholder">{t('settings.noLogoUploaded')}</div>
              )}
              <button
                type="button"
                className="logo-upload-btn"
                disabled={logoUploading}
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUploading ? t('common.uploading') : t('settings.chooseImage')}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const firstUrl = URL.createObjectURL(file);
                  setLogoPreview(firstUrl);
                  setLogoUploading(true);
                  try {
                    const processed = await cropLogoImage(file);
                    const processedUrl = URL.createObjectURL(processed);
                    setLogoPreview(processedUrl);
                    URL.revokeObjectURL(firstUrl);
                    const fd = new FormData();
                    fd.append('logo', processed, 'logo.png');
                    const res = await api.upload('/api/settings/logo', fd);
                    handleChange('systemLogo', res.logo);
                    setLogoPreview(null);
                    URL.revokeObjectURL(processedUrl);
                    addToast(t('settings.logoUploaded'), 'success');
                  } catch (err) {
                    console.error('Logo upload error:', err);
                    setLogoPreview(null);
                    addToast(t('common.uploadFailed') + ': ' + (err.message || 'unknown error'), 'error');
                  } finally {
                    if (logoInputRef.current) logoInputRef.current.value = '';
                    setLogoUploading(false);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Request Settings */}
        <div className="settings-card">
          <h3>{t('settings.requestSettings')}</h3>
          <div className="settings-field">
            <label>{t('settings.defaultStatus')}</label>
            <select value={form.defaultStatus} onChange={e => handleChange('defaultStatus', e.target.value)}>
              <option value="">{t('settings.selectDefaultStatus')}</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.defaultPriority')}</label>
            <select value={form.defaultPriority} onChange={e => handleChange('defaultPriority', e.target.value)}>
              <option value="">{t('settings.selectDefaultPriority')}</option>
              {priorities.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.autoRequestId')}</span>
              <span className="toggle-sublabel">{t('settings.autoRequestIdDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.autoRequestId} onChange={e => handleChange('autoRequestId', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="settings-field">
            <label>{t('settings.maxFileSize')}</label>
            <input type="number" value={form.maxFileSize} onChange={e => handleChange('maxFileSize', parseInt(e.target.value) || 0)} min="1" />
          </div>
          <div className="settings-field">
            <label>{t('settings.allowedFileTypes')}</label>
            <select value={form.allowedFileTypes || ''} onChange={e => handleChange('allowedFileTypes', e.target.value)}>
              <option value="">{t('settings.selectFileType')}</option>
              {FILE_TYPE_OPTIONS.map(ft => (
                <option key={ft} value={ft}>.{ft}</option>
              ))}
            </select>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.allowReopen')}</span>
              <span className="toggle-sublabel">{t('settings.allowReopenDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.allowReopen} onChange={e => handleChange('allowReopen', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Create Request Feature Toggle */}
        <div className="settings-card">
          <h3>Create Request</h3>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">Enable Create Request</span>
              <span className="toggle-sublabel">Allow admins to create requests on behalf of clients</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.createRequestEnabled} onChange={e => handleChange('createRequestEnabled', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Status Management */}
        <div className="settings-card">
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}
            onClick={() => setShowStatusManagement(!showStatusManagement)}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, textAlign: 'left' }}>Status Management</h3>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: showStatusManagement ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <path d="M5 7.5L10 12.5L15 7.5" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: 'grid', gridTemplateRows: showStatusManagement ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div style={{ overflow: 'hidden' }}>
          <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button className="btn btn-primary" onClick={() => openStatusModal()} style={{ minWidth: '0' }}>
              + Add Status
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Order</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Status Name</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Color</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Active</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allStatuses.map((status, index) => (
                  <tr key={status.id} style={{ borderBottom: '1px solid #f3f4f6', opacity: status.is_active === false ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => moveStatus(index, -1)}
                          disabled={index === 0}
                          title="Move up"
                          style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', cursor: index === 0 ? 'not-allowed' : 'pointer', background: index === 0 ? '#f9fafb' : '#fff', fontSize: '14px', fontWeight: 600, opacity: index === 0 ? 0.4 : 1, color: '#374151' }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveStatus(index, 1)}
                          disabled={index === allStatuses.length - 1}
                          title="Move down"
                          style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', cursor: index === allStatuses.length - 1 ? 'not-allowed' : 'pointer', background: index === allStatuses.length - 1 ? '#f9fafb' : '#fff', fontSize: '14px', fontWeight: 600, opacity: index === allStatuses.length - 1 ? 0.4 : 1, color: '#374151' }}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '14px' }}>{status.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: status.color, border: '1px solid #e5e7eb' }}></div>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>{status.color}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {status.is_system ? (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#dbeafe', color: '#1d4ed8', fontWeight: 600 }}>System</span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#f3f4f6', color: '#374151', fontWeight: 600 }}>Custom</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={status.is_active !== false}
                          onChange={() => handleStatusToggle(status)}
                        />
                        <span className="slider"></span>
                      </label>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-outline"
                          onClick={() => openStatusModal(status)}
                          style={{ minWidth: '0', padding: '6px 14px', fontSize: '13px', fontWeight: 500, color: '#4338ca', borderColor: '#a5b4fc', background: '#eef2ff' }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          onClick={() => handleStatusDelete(status)}
                          disabled={status.is_system}
                          style={{ minWidth: '0', padding: '6px 14px', fontSize: '13px', fontWeight: 500, color: status.is_system ? '#9ca3af' : '#dc2626', borderColor: status.is_system ? '#e5e7eb' : '#fca5a5', cursor: status.is_system ? 'not-allowed' : 'pointer', background: status.is_system ? '#f9fafb' : '#fef2f2' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
          </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="settings-card">
          <h3>{t('settings.notifications')}</h3>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.emailNotifications')}</span>
              <span className="toggle-sublabel">{t('settings.emailNotificationsDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.emailNotifications} onChange={e => handleChange('emailNotifications', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.inAppNotifications')}</span>
              <span className="toggle-sublabel">{t('settings.inAppAlertsDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.inAppNotifications} onChange={e => handleChange('inAppNotifications', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.autoAssign')}</span>
              <span className="toggle-sublabel">{t('settings.autoAssignDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.autoAssign} onChange={e => handleChange('autoAssign', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.soundAlerts')}</span>
              <span className="toggle-sublabel">{t('settings.soundAlertsDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.soundAlerts} onChange={e => handleChange('soundAlerts', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.desktopNotifications')}</span>
              <span className="toggle-sublabel">{t('settings.desktopNotificationsDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.desktopNotifications} onChange={e => handleChange('desktopNotifications', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.notifyClientStatusChange')}</span>
              <span className="toggle-sublabel">{t('settings.notifyClientStatusChangeDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.notifyClientStatusChange} onChange={e => handleChange('notifyClientStatusChange', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.notifyDeveloperAssignment')}</span>
              <span className="toggle-sublabel">{t('settings.notifyDeveloperAssignmentDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.notifyDeveloperAssignment} onChange={e => handleChange('notifyDeveloperAssignment', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* SLA Settings */}
        <div className="settings-card">
          <h3>{t('settings.sla')}</h3>
          <div className="settings-field">
            <label>{t('settings.responseHours')}</label>
            <div className="input-with-unit">
              <input type="number" value={form.responseHours} onChange={e => handleChange('responseHours', parseInt(e.target.value) || 0)} min="1" />
              <span className="input-unit">{t('settings.hours')}</span>
            </div>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('settings.responseHoursDesc')}</span>
          </div>
          <div className="settings-field">
            <label>{t('settings.resolutionHours')}</label>
            <div className="input-with-unit">
              <input type="number" value={form.resolutionHours} onChange={e => handleChange('resolutionHours', parseInt(e.target.value) || 0)} min="1" />
              <span className="input-unit">{t('settings.hours')}</span>
            </div>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('settings.resolutionHoursDesc')}</span>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.escalationEnabled')}</span>
              <span className="toggle-sublabel">{t('settings.escalationEnabledDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.escalationEnabled} onChange={e => handleChange('escalationEnabled', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Working Hours */}
        <div className="settings-card">
          <h3>{t('settings.workingHours')}</h3>
          <div className="settings-field">
            <label>{t('settings.workStart')}</label>
            <input type="time" value={form.workStart} onChange={e => handleChange('workStart', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.workEnd')}</label>
            <input type="time" value={form.workEnd} onChange={e => handleChange('workEnd', e.target.value)} />
          </div>
<div className="settings-field">
            <label>{t('settings.weekendDays')}</label>
            <select value={form.weekendDays || ''} onChange={e => handleChange('weekendDays', e.target.value)}>
              <option value="">{t('settings.selectWeekendDay')}</option>
              {DAYS_OF_WEEK.map(day => (
                <option key={day} value={day}>{t('days.' + day)}</option>
              ))}
            </select>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.holidaysEnabled')}</span>
              <span className="toggle-sublabel">{t('settings.holidaysEnabledDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.holidaysEnabled} onChange={e => handleChange('holidaysEnabled', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Security Settings */}
        <div className="settings-card">
          <h3>{t('settings.security')}</h3>
          <div className="settings-field">
            <label>{t('settings.passwordExpiry')}</label>
            <div className="input-with-unit">
              <input type="number" value={form.passwordExpiry} onChange={e => handleChange('passwordExpiry', parseInt(e.target.value) || 0)} min="0" max="365" />
              <span className="input-unit">{t('settings.days')}</span>
            </div>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('settings.passwordExpiryDesc')}</span>
          </div>
          <div className="settings-field">
            <label>{t('settings.passwordLength')}</label>
            <div className="input-with-unit">
              <input type="number" value={form.passwordLength} onChange={e => handleChange('passwordLength', parseInt(e.target.value) || 0)} min="4" max="64" />
              <span className="input-unit">{t('settings.characters')}</span>
            </div>
          </div>
          <div className="settings-field">
            <label>{t('settings.sessionTimeout')}</label>
            <select value={form.sessionTimeout} onChange={e => handleChange('sessionTimeout', Number(e.target.value))}>
              <option value={15}>{t('settings.minutesN', { n: 15 })}</option>
              <option value={30}>{t('settings.minutesN', { n: 30 })}</option>
              <option value={45}>{t('settings.minutesN', { n: 45 })}</option>
              <option value={60}>{t('settings.minutesN', { n: 60 })}</option>
              <option value={120}>{t('settings.hoursN', { n: 2 })}</option>
              <option value={240}>{t('settings.hoursN', { n: 4 })}</option>
              <option value={480}>{t('settings.hoursN', { n: 8 })}</option>
              <option value={0}>{t('settings.never')}</option>
            </select>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('settings.sessionTimeoutDesc')}</span>
          </div>
          <div className="settings-field">
            <label>{t('settings.maxLoginAttempts')}</label>
            <input type="number" value={form.maxLoginAttempts} onChange={e => handleChange('maxLoginAttempts', parseInt(e.target.value) || 0)} min="1" max="20" />
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('settings.maxLoginAttemptsDesc')}</span>
          </div>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.twoFactorAuth')}</span>
              <span className="toggle-sublabel">{t('settings.twoFactorAuthDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.twoFactorAuth} onChange={e => handleChange('twoFactorAuth', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-card">
          <h3>{t('settings.appearance')}</h3>
          <div className="settings-field">
            <label>{t('settings.theme')}</label>
            <select value={form.theme} onChange={e => handleChange('theme', e.target.value)}>
              <option value="partial">{t('settings.partialMode')}</option>
              <option value="light">{t('settings.lightMode')}</option>
              <option value="dark">{t('settings.darkMode')}</option>
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.accentColor')}</label>
            <input type="color" value={form.accentColor} onChange={e => handleChange('accentColor', e.target.value)} />
          </div>
          <div className="settings-field">
            <label>{t('settings.sidebarStyle')}</label>
            <select value={form.sidebarStyle} onChange={e => handleChange('sidebarStyle', e.target.value)}>
              <option value="compact">{t('settings.compact')}</option>
              <option value="comfortable">{t('settings.comfortable')}</option>
            </select>
          </div>
        </div>

        {/* Assignment Settings */}
        <div className="settings-card">
          <h3>{t('settings.assignmentSettings')}</h3>
          <div className="settings-field">
            <label>{t('settings.assignmentMode')}</label>
            <select value={form.assignmentMode} onChange={e => handleChange('assignmentMode', e.target.value)}>
              <option value="group-based">{t('settings.groupBased')}</option>
              <option value="manual">{t('settings.manual')}</option>
              <option value="auto">{t('settings.auto')}</option>
            </select>
          </div>
          <div className="settings-field">
            <label>{t('settings.defaultGroup')}</label>
            <select value={form.defaultGroup} onChange={e => handleChange('defaultGroup', e.target.value)}>
              <option value="">{t('settings.noDefaultGroup')}</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Backup & Maintenance */}
        <div className="settings-card">
          <h3>{t('settings.backupMaintenance')}</h3>
          <div className="toggle-row-settings">
            <div>
              <span className="toggle-label">{t('settings.autoBackup')}</span>
              <span className="toggle-sublabel">{t('settings.autoBackupDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.autoBackup} onChange={e => handleChange('autoBackup', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
          <div className="settings-field">
            <label>{t('settings.backupFrequency')}</label>
            <select value={form.backupFrequency} onChange={e => handleChange('backupFrequency', e.target.value)} disabled={!form.autoBackup}>
              <option value="daily">{t('settings.daily')}</option>
              <option value="weekly">{t('settings.weekly')}</option>
              <option value="monthly">{t('settings.monthly')}</option>
            </select>
          </div>
          <div className="toggle-row-settings" style={{ marginTop: '8px' }}>
            <div>
              <span className="toggle-label">{t('settings.maintenanceMode')}</span>
              <span className="toggle-sublabel">{t('settings.maintenanceModeDesc')}</span>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.maintenanceMode} onChange={e => handleChange('maintenanceMode', e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ minWidth: '0' }}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          <button className="btn btn-outline" onClick={handleReset} disabled={saving} style={{ minWidth: '0' }}>
            {t('settings.reset')}
          </button>
        </div>
      </div>

      {statusModal && (
        <div onClick={closeStatusModal} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 50%, #c7d2fe 100%)', borderRadius: '16px', padding: '28px', width: '90%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid #e0e7ff' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#1e1b4b' }}>
              {editingStatus ? 'Edit Status' : 'Create Status'}
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                Status Name
              </label>
              <input
                type="text"
                value={statusForm.name}
                onChange={e => setStatusForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter status name"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.8)' }}
                autoFocus
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="color"
                  value={statusForm.color}
                  onChange={e => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                  style={{ width: '48px', height: '40px', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer', padding: '2px', background: 'rgba(255,255,255,0.8)' }}
                />
                <span style={{ fontSize: '14px', color: '#1f2937', fontWeight: 600 }}>{statusForm.color}</span>
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>
                Status Type
              </label>
              <select
                value={statusForm.type || 'custom'}
                onChange={e => setStatusForm(prev => ({ ...prev, type: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #c7d2fe', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.8)' }}
              >
                <option value="custom">Custom</option>
                <option value="system">System</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-outline"
                onClick={closeStatusModal}
                disabled={statusSaving}
                style={{ minWidth: '0' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleStatusSave}
                disabled={statusSaving}
                style={{ minWidth: '0' }}
              >
                {statusSaving ? 'Saving...' : editingStatus ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {statusDeleteTarget && (
        <div className="modal-overlay" onClick={() => setStatusDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>Are you sure you want to delete "{statusDeleteTarget.name}"?</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setStatusDeleteTarget(null)} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '1px solid #475569', background: '#334155', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmStatusDelete} style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
