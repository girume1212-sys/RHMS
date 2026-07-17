import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';
import { availableLanguages } from '../i18n/translations';
import { useLanguage } from '../i18n/LanguageContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Settings() {
  const { t, language } = useTranslation();
  const { changeLanguage } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [form, setForm] = useState({
    companyName: 'RHMS Support System',
    supportEmail: '',
    requestPrefix: 'REQ',
    defaultPriority: ['Low', 'Medium', 'High'],
    ticketAutoClose: 5,
    defaultAssignmentRule: '',
    escalationTrigger: '',
    slaBreachAction: '',
    primaryLanguage: 'en',
    emailOnNewTicket: true,
    emailOnStatusChange: true,
    emailOnEscalation: true,
    inAppAlerts: true,
    inAppEscalation: true,
    desktopNotifications: false,
    soundEnabled: true,
  });

  const fetchSettings = useCallback(async () => {
    try {
      const data = await api.get('/api/settings');
      const parsed = { ...data };
      if (typeof parsed.defaultPriority === 'string') {
        try { parsed.defaultPriority = JSON.parse(parsed.defaultPriority); } catch {}
      }
      ['emailOnNewTicket','emailOnStatusChange','emailOnEscalation','inAppAlerts','inAppEscalation','desktopNotifications','soundEnabled'].forEach(k => {
        if (typeof parsed[k] === 'string') parsed[k] = parsed[k] === 'true';
      });
      if (typeof parsed.ticketAutoClose === 'string') parsed.ticketAutoClose = Number(parsed.ticketAutoClose);
      setForm(prev => ({ ...prev, ...parsed }));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const togglePriority = (p) => {
    setForm(prev => {
      const current = prev.defaultPriority || [];
      return {
        ...prev,
        defaultPriority: current.includes(p) ? current.filter(x => x !== p) : [...current, p]
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        companyName: form.companyName,
        supportEmail: form.supportEmail,
        requestPrefix: form.requestPrefix,
        defaultPriority: JSON.stringify(form.defaultPriority),
        ticketAutoClose: String(form.ticketAutoClose),
        defaultAssignmentRule: form.defaultAssignmentRule,
        escalationTrigger: form.escalationTrigger,
        slaBreachAction: form.slaBreachAction,
        primaryLanguage: form.primaryLanguage,
        emailOnNewTicket: String(form.emailOnNewTicket),
        emailOnStatusChange: String(form.emailOnStatusChange),
        emailOnEscalation: String(form.emailOnEscalation),
        inAppAlerts: String(form.inAppAlerts),
        inAppEscalation: String(form.inAppEscalation),
        desktopNotifications: String(form.desktopNotifications),
        soundEnabled: String(form.soundEnabled),
      };
      await api.put('/api/settings', payload);
      if (form.primaryLanguage !== language) {
        changeLanguage(form.primaryLanguage);
      }
      addToast(t('settings.saved'));
      showStatusToast('System settings updated', 'status');
    } catch (err) {
      console.error('Save settings error:', err);
      addToast(err.message || t('settings.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;

  return (
    <div className="settings-page">
      <div className="toast-container">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      <div className="settings-header">
        <h1>{t('settings.title')}</h1>
        <div className="settings-header-right">
          <div className="settings-date">
            <span className="settings-date-icon">📅</span>
            <span>{new Date().toLocaleDateString(language === 'am' ? 'am-ET' : language === 'ar' ? 'ar-SA' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : language === 'pt' ? 'pt-PT' : language === 'zh' ? 'zh-CN' : language === 'or' ? 'om-ET' : language === 'so' ? 'so-SO' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <button className="btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      <div className="settings-grid-2col">
        {/* Left Column */}
        <div className="settings-col">
          {/* General Settings */}
          <div className="settings-card">
            <h3>{t('settings.general')}</h3>
            <div className="settings-field">
              <label>{t('settings.companyName')}</label>
              <input type="text" value={form.companyName} onChange={e => handleChange('companyName', e.target.value)} />
            </div>
            <div className="settings-field">
              <label>{t('settings.supportEmail')}</label>
              <input type="email" placeholder={t('settings.supportEmail')} value={form.supportEmail} onChange={e => handleChange('supportEmail', e.target.value)} />
            </div>
            <div className="settings-field">
              <label>{t('settings.requestPrefix')}</label>
              <input type="text" value={form.requestPrefix} onChange={e => handleChange('requestPrefix', e.target.value)} />
            </div>
            <div className="settings-field">
              <label>{t('settings.defaultPriority')}</label>
              <div className="checkbox-list">
                {[t('settings.low'), t('settings.medium'), t('settings.high'), t('settings.critical')].map((label, i) => {
                  const val = ['Low', 'Medium', 'High', 'Critical'][i];
                  return (
                    <label key={val} className="checkbox-item">
                      <input type="checkbox" checked={(form.defaultPriority || []).includes(val)} onChange={() => togglePriority(val)} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Request & Escalation */}
          <div className="settings-card">
            <h3>{t('settings.requestEscalation')}</h3>
            <div className="settings-field">
              <label>{t('settings.ticketAutoClose')}</label>
              <div className="input-with-unit">
                <input type="number" value={form.ticketAutoClose} onChange={e => handleChange('ticketAutoClose', parseInt(e.target.value) || 0)} min="1" />
                <span className="input-unit">[{t('settings.days').toLowerCase()}]</span>
              </div>
            </div>
            <div className="settings-field">
              <label>{t('settings.assignmentRule')}</label>
              <select value={form.defaultAssignmentRule} onChange={e => handleChange('defaultAssignmentRule', e.target.value)}>
                <option value="">{t('settings.selectAssignmentRule')}</option>
                <option value="round_robin">{t('settings.roundRobin')}</option>
                <option value="least_load">{t('settings.leastLoad')}</option>
                <option value="manual">{t('settings.manual')}</option>
              </select>
            </div>
            <div className="settings-field">
              <label>{t('settings.escalationTrigger')}</label>
              <select value={form.escalationTrigger} onChange={e => handleChange('escalationTrigger', e.target.value)}>
                <option value="">{t('settings.selectEscalationTrigger')}</option>
                <option value="timeout">{t('settings.timeout')}</option>
                <option value="priority">{t('settings.priorityBased')}</option>
                <option value="no_response">{t('settings.noResponse')}</option>
                <option value="manual">{t('settings.manual')}</option>
              </select>
            </div>
            <div className="settings-field">
              <label>{t('settings.slaBreachAction')}</label>
              <select value={form.slaBreachAction} onChange={e => handleChange('slaBreachAction', e.target.value)}>
                <option value="">{t('settings.selectSlaBreachAction')}</option>
                <option value="escalate">{t('settings.escalateImmediately')}</option>
                <option value="notify">{t('settings.notifyManager')}</option>
                <option value="auto_assign">{t('settings.autoAssignSenior')}</option>
                <option value="none">{t('settings.noAction')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="settings-col">
          {/* Language Options */}
          <div className="settings-card">
            <h3>{t('settings.languageOptions')}</h3>
            <div className="settings-field">
              <label>{t('settings.primaryLanguage')}</label>
              <div className="language-select">
                <span className="language-select-icon">🌐</span>
                <select value={form.primaryLanguage} onChange={e => handleChange('primaryLanguage', e.target.value)}>
                  {availableLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="settings-card">
            <h3>{t('settings.emailNotifications')}</h3>
            <div className="toggle-row-settings">
              <div>
                <span className="toggle-label">{t('settings.emailOnNewTicket')}</span>
                <span className="toggle-sublabel">{t('settings.emailOnNewTicketDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.emailOnNewTicket} onChange={e => handleChange('emailOnNewTicket', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="toggle-row-settings">
              <div>
                <span className="toggle-label">{t('settings.emailOnStatusChange')}</span>
                <span className="toggle-sublabel">{t('settings.emailOnStatusChangeDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.emailOnStatusChange} onChange={e => handleChange('emailOnStatusChange', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="toggle-row-settings">
              <div>
                <span className="toggle-label">{t('settings.emailOnEscalation')}</span>
                <span className="toggle-sublabel">{t('settings.emailOnEscalationDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.emailOnEscalation} onChange={e => handleChange('emailOnEscalation', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          {/* In-App Notifications */}
          <div className="settings-card">
            <h3>{t('settings.inAppNotifications')}</h3>
            <div className="toggle-row-settings">
              <div>
                <span className="toggle-label">{t('settings.inAppAlerts')}</span>
                <span className="toggle-sublabel">{t('settings.inAppAlertsDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.inAppAlerts} onChange={e => handleChange('inAppAlerts', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
            <div className="toggle-row-settings">
              <div>
                <span className="toggle-label">{t('settings.escalationAlerts')}</span>
                <span className="toggle-sublabel">{t('settings.escalationAlertsDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.inAppEscalation} onChange={e => handleChange('inAppEscalation', e.target.checked)} />
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
                <span className="toggle-label">{t('settings.soundAlerts')}</span>
                <span className="toggle-sublabel">{t('settings.soundAlertsDesc')}</span>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.soundEnabled} onChange={e => handleChange('soundEnabled', e.target.checked)} />
                <span className="slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
