import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../api';
import { useAuth } from '../AuthContext';
import Toast from './Toast';
import { showStatusToast } from '../notify';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';

const CATEGORY_TEMPLATES = [
  { id: '1', name: 'Hardware', icon: '🖥️', color: '#3B82F6' },
  { id: '2', name: 'Software', icon: '💿', color: '#10B981' },
  { id: '3', name: 'Network', icon: '🌐', color: '#F59E0B' },
  { id: '4', name: 'Security', icon: '🔒', color: '#EF4444' },
  { id: '5', name: 'Email', icon: '📧', color: '#8B5CF6' },
  { id: '6', name: 'Account', icon: '👤', color: '#06B6D4' },
  { id: '7', name: 'Data', icon: '💾', color: '#EC4899' },
  { id: '8', name: 'Other', icon: '📋', color: '#6B7280' },
];

export default function CreateRequest() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({ subject: '', description: '', categoryId: '', priorityId: '2' });
  const [categories, setCategories] = useState([]);
  const [prioritiesList, setPriorities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  const categoryTemplates = CATEGORY_TEMPLATES.map(c => ({
    ...c,
    name: t('category.' + c.name),
    description: t('category.' + c.name + 'Desc')
  }));

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    api.get('/api/categories').then(setCategories);
    api.get('/api/priorities').then(setPriorities);
    api.get('/api/settings/public').then(settings => {
      if (settings.defaultPriority) {
        setForm(prev => ({ ...prev, priorityId: settings.defaultPriority }));
      }
    }).catch(() => {});
  }, []);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const uploaded = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await fetch(`${API_BASE}/api/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('rhms_token')}` },
          body: formData
        });
        const data = await res.json();
        if (data.path) uploaded.push(data.path);
      } catch (err) {
        console.error('Upload failed:', err);
        addToast(t('common.uploadFailed') + ': ' + err.message, 'error');
      }
    }
    return uploaded;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim() || !form.categoryId) {
      setError(t('common.fillRequiredFields'));
      addToast(t('common.fillRequiredFields'), 'error');
      return;
    }
    setLoading(true);
    setError('');
    try {
      let attachments = [];
      if (files.length > 0) {
        setUploading(true);
        attachments = await uploadFiles();
        setUploading(false);
      }
      await api.post('/api/requests', { ...form, attachments });
      addToast(t('common.requestCreatedSuccess'));
      showStatusToast(t('common.newRequestCreated', { subject: form.subject }), 'request_created');
      navigate(`${basePath}/requests`);
    } catch (err) {
      setError(err.message);
      addToast(t('common.failedToCreateRequest') + ': ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
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
          <button className="back-link" onClick={() => navigate(`${basePath}/requests`)}>← {t('common.backToRequests')}</button>
          <h1>{t('common.createRequest')}</h1>
          <p>{t('common.submitNewRequest')}</p>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>{t('common.requestTitle')} *</label>
            <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t('common.briefDescription')} required />
          </div>
          <div className="form-row">
          <div className="form-group">
            <label>{t('common.category')} *</label>
            <div className="category-cards">
              {categoryTemplates.map(c => (
                <div
                  key={c.id}
                  className={`category-card-select ${form.categoryId === c.id ? 'selected' : ''}`}
                  onClick={() => setForm({ ...form, categoryId: c.id })}
                  style={{ '--cat-color': c.color }}
                >
                  <div className="category-card-icon">{c.icon}</div>
                  <div className="category-card-name">{transSeeded(c.name, 'category', t)}</div>
                  <div className="category-card-desc">{c.description}</div>
                </div>
              ))}
            </div>
            {form.categoryId && (
              <input type="hidden" value={form.categoryId} required />
            )}
          </div>
            <div className="form-group">
              <label>{t('common.priority')}</label>
              <select value={form.priorityId} onChange={(e) => setForm({ ...form, priorityId: e.target.value })}>
                {prioritiesList.map(p => <option key={p.id} value={p.id}>{transSeeded(p.name, 'priority', t)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>{t('common.description')} *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('common.provideDetails')} rows={8} required />
          </div>
          <div className="form-group">
            <label>{t('common.attachments')}</label>
            <div className="file-upload" onClick={() => fileInputRef.current.click()}>
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div className="file-upload-icon">📤</div>
              <div className="file-upload-text">{t('common.clickToUpload')}</div>
              <div className="file-upload-hint">{t('common.uploadHint')}</div>
            </div>
            {files.length > 0 && (
              <div className="file-preview-list">
                {files.map((file, i) => (
                  <div key={i} className="file-preview-item">
                    <div className="file-preview-icon">
                      {file.type.startsWith('image/') ? '🖼️' : '📄'}
                    </div>
                    <div className="file-preview-info">
                      <span className="file-preview-name">{file.name}</span>
                      <span className="file-preview-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button type="button" className="file-preview-remove" onClick={() => removeFile(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => navigate(`${basePath}/requests`)}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('common.submitting') : t('common.submitRequest')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
