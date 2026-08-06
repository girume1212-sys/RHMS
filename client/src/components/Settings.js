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
  };

  const [form, setForm] = useState({ ...initialForm });

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/api/settings'),
      api.get('/api/companies'),
      api.get('/api/groups'),
      api.get('/api/statuses'),
      api.get('/api/priorities'),
    ]).then(([settingsData, companiesData, groupsData, statusesData, prioritiesData]) => {
      setCompanies(Array.isArray(companiesData) ? companiesData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setStatuses(Array.isArray(statusesData) ? statusesData : []);
      setPriorities(Array.isArray(prioritiesData) ? prioritiesData : []);
      setForm(prev => {
        const merged = { ...prev, ...settingsData };
        const boolKeys = [
          'autoRequestId', 'allowReopen', 'emailNotifications', 'inAppNotifications',
          'notifyClientStatusChange', 'notifyDeveloperAssignment', 'autoAssign',
          'soundAlerts', 'desktopNotifications', 'twoFactorAuth', 'maintenanceMode',
          'escalationEnabled', 'holidaysEnabled', 'autoBackup'
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
    </div>
  );
}
