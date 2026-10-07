import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';

export default function Priorities() {
  const { t } = useTranslation();
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/priorities').then(data => { setPriorities(data); setLoading(false); })
      .catch(err => { setError(t('priority.failedToLoad') + ': ' + err.message); setLoading(false); });
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← {t('common.back')}</button>
          <h1>{t('sidebar.priorities')}</h1>
          <p>{t('priority.manageSubtitle')}</p>
        </div>
      </div>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}
      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="grid-cards">
          {priorities.map(p => (
            <div key={p.id} className="priority-card">
              <div className="priority-color" style={{ background: p.color }}></div>
              <h3>{t('priority.' + p.name)}</h3>
              <p>{t('priority.level', { level: p.level })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
