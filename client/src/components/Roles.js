import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';

export default function Roles() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/roles').then(data => { setRoles(data); setLoading(false); })
      .catch(err => { setError(t('common.failedToLoadRoles') + ': ' + err.message); setLoading(false); });
  }, []);

  const roleColors = { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' };
  const roleIcons = { admin: 'crown', support: 'zap', developer: 'code', client: 'user' };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← {t('common.back')}</button>
          <h1>{t('common.rolesAndPermissions')}</h1>
          <p>{t('common.manageRoles')}</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="grid-cards">
          {roles.map(r => (
            <div key={r.id} className="role-card">
              <div className="role-icon" style={{ background: roleColors[r.id] + '20', color: roleColors[r.id] }}>
                <Icon name={roleIcons[r.id] || 'user'} size={24} />
              </div>
              <h3>{t('role.' + r.id)}</h3>
              <div className="permissions-list">
                {r.permissions.map((p, i) => (
                  <span key={i} className="permission-tag">{p}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
