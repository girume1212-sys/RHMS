import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import RequestsTable from './RequestsTable';

export default function RequestsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isClient = user?.role === 'client';
  const basePath = isClient ? '/client' : '';

  const initialFilter = {
    status: searchParams.get('status') || '',
    priority: searchParams.get('priority') || '',
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || ''
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => navigate(basePath || '/')}>← Back</button>
          <h1>Requests</h1>
          <p>{isClient ? 'View your support requests' : 'Manage all support requests'}</p>
        </div>
        {(isClient || user?.role === 'admin') && (
          <button className="btn btn-primary" onClick={() => navigate(`${basePath}/requests/create`)}>
            + Create Request
          </button>
        )}
      </div>
      <RequestsTable user={user} basePath={basePath} initialFilter={initialFilter} />
    </div>
  );
}
