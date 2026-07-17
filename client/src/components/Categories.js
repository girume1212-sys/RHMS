import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Categories() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const categoryMeta = [
    { id: '1', name: 'Hardware', icon: '🖥️', color: '#3B82F6', description: 'Computer, printer, peripherals' },
    { id: '2', name: 'Software', icon: '💿', color: '#10B981', description: 'Applications, OS, licensing' },
    { id: '3', name: 'Network', icon: '🌐', color: '#F59E0B', description: 'WiFi, internet, connectivity' },
    { id: '4', name: 'Security', icon: '🔒', color: '#EF4444', description: 'Viruses, malware, access issues' },
    { id: '5', name: 'Email', icon: '📧', color: '#8B5CF6', description: 'Email setup, calendar, Outlook' },
    { id: '6', name: 'Account', icon: '👤', color: '#06B6D4', description: 'Login, password, permissions' },
    { id: '7', name: 'Data', icon: '💾', color: '#EC4899', description: 'Backup, recovery, storage' },
    { id: '8', name: 'Other', icon: '📋', color: '#6B7280', description: 'General inquiries, other issues' },
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    setError('');
    setLoading(true);
    api.get('/api/requests').then(reqs => {
      setRequests(reqs);
      setLoading(false);
    }).catch(err => { setError('Failed to load data: ' + err.message); setLoading(false); });
  };

  const handleViewDetails = (categoryId) => {
    navigate(`/requests?category=${categoryId}`);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Categories</h1>
          <p>Manage request categories</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="requests-by-category-card">
          <h3>Requests by Category</h3>
          <div className="category-cards-grid">
            {categoryMeta.map(c => {
              const count = requests.filter(r => r.categoryId === c.id).length;
              return (
                <div key={c.id} className="category-manage-card" style={{ '--cat-color': c.color }}>
                  <div className="category-manage-card-top">
                    <div className="category-manage-icon">{c.icon}</div>
                    <span className="category-manage-count">{count} requests</span>
                  </div>
                  <div className="category-manage-name">{c.name}</div>
                  <div className="category-manage-desc">{c.description}</div>
                  <div className="category-manage-actions">
                    <button className="category-view-btn" onClick={() => handleViewDetails(c.id)}>View Details</button>
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
