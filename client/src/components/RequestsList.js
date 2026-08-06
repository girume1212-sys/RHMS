import React from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import RequestsTable from './RequestsTable';

export default function RequestsList() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  const initialFilter = {
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || ''
  };

  const fromCategories = user?.role === 'admin' && !!initialFilter.category;

  const handleBack = () => {
    if (fromCategories) {
      if (location.key !== 'default') {
        navigate(-1);
      } else {
        navigate('/categories');
      }
    } else {
      navigate(basePath || '/');
    }
  };

  return (
    <div className="page-container requests-list">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={handleBack}>← {t('common.back')}</button>
          <h1>{t('common.requests')}</h1>
          <p>{isClient ? t('common.viewYourRequests') : t('common.manageAllRequests')}</p>
        </div>
        {(isClient || user?.role === 'admin') && (
          <button className="btn btn-primary" onClick={() => navigate(`${basePath}/requests/create`)}>
            + {t('common.createRequest')}
          </button>
        )}
      </div>
      <RequestsTable user={user} basePath={basePath} initialFilter={initialFilter} />
    </div>
  );
}
