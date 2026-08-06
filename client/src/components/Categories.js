import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';

export default function Categories() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const categoryMeta = [
    { id: '1', name: 'Hardware', icon: 'monitor', color: '#3B82F6', description: 'Computer, printer, peripherals' },
    { id: '2', name: 'Software', icon: 'disc', color: '#10B981', description: 'Applications, OS, licensing' },
    { id: '3', name: 'Network', icon: 'wifi', color: '#F59E0B', description: 'WiFi, internet, connectivity' },
    { id: '4', name: 'Security', icon: 'shield', color: '#EF4444', description: 'Viruses, malware, access issues' },
    { id: '5', name: 'Email', icon: 'mail', color: '#8B5CF6', description: 'Email setup, calendar, Outlook' },
    { id: '6', name: 'Account', icon: 'user', color: '#06B6D4', description: 'Login, password, permissions' },
    { id: '7', name: 'Data', icon: 'database', color: '#EC4899', description: 'Backup, recovery, storage' },
    { id: '8', name: 'Other', icon: 'clipboard', color: '#6B7280', description: 'General inquiries, other issues' },
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    setError('');
    setLoading(true);
    api.get('/api/requests').then(reqs => {
      setRequests(reqs);
      setLoading(false);
    }).catch(err => { setError(t('common.failedToLoadData') + ': ' + err.message); setLoading(false); });
  };

  const handleViewDetails = (categoryId) => {
    navigate(`/requests?category=${categoryId}`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← {t('common.back')}</button>
          <h1>{t('sidebar.categories')}</h1>
          <p>{t('category.manageSubtitle')}</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="requests-by-category-card">
          <h3>{t('dashboard.requestsByCategory')}</h3>
          <div className="category-cards-grid">
            {categoryMeta.map(c => {
              const count = requests.filter(r => r.categoryId === c.id).length;
              return (
                <div key={c.id} className="category-manage-card" style={{ '--cat-color': c.color, cursor: 'pointer' }} onClick={() => handleViewDetails(c.id)}>
                  <div className="category-manage-card-top">
                    <div className="category-manage-icon"><Icon name={c.icon} size={32} /></div>
                    <span className="category-manage-count">{t('category.requestsCount', { count })}</span>
                  </div>
                  <div className="category-manage-name">{t('category.' + c.name)}</div>
                  <div className="category-manage-desc">{t('category.' + c.name + 'Desc')}</div>
                  <div className="category-manage-actions">
                    <button className="category-view-btn" onClick={() => handleViewDetails(c.id)}>{t('category.viewDetails')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
