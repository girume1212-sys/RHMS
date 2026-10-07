import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { saveSearchQuery } from '../utils/searchStore';
import { useTranslation } from '../i18n/useTranslation';
import PageNumbers from './PageNumbers';
import Icon from './Icon';
import { API_BASE } from '../api';

function getRoleColor(role) {
  return { admin: '#EF4444', support: '#3B82F6', developer: '#8B5CF6', client: '#10B981' }[role] || '#6B7280';
}

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="table-pagination" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
      <button className="page-btn" disabled={page === 1} onClick={() => onPageChange(1)}>«</button>
      <button className="page-btn" disabled={page === 1} onClick={() => onPageChange(page - 1)}>‹</button>
      <PageNumbers page={page} totalPages={totalPages} onPageChange={onPageChange} />
      <button className="page-btn" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      <button className="page-btn" disabled={page === totalPages} onClick={() => onPageChange(totalPages)}>»</button>
    </div>
  );
}

function RequestSection({ title, data, requestBase, onNavigate }) {
  const { t } = useTranslation();
  if (!data || data.total === 0) return null;
  return (
    <div className="search-results-section">
      <div className="search-results-section-header">{title} ({data.total})</div>
      <div className="search-results-table">
        {data.items.map(r => (
          <button key={r.id} className="search-result-row search-result-row-request" onClick={() => onNavigate(`${requestBase}/${r.id}`)}>
            <div className="search-result-row-main">
              <span className="search-result-id">REQ-{String(r.id).padStart(4, '0')}</span>
              <span className="search-result-title">{r.subject}</span>
            </div>
            <div className="search-result-row-meta">
              {r.client_deleted ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="user" size={13} /> {t('common.clientDeleted')}</span> : (r.client_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="user" size={13} /> {r.client_name}</span>)}
              {r.assignee_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="wrench" size={13} /> {r.assignee_name}</span>}
              {r.assigned_group_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="company" size={13} /> {r.assigned_group_name}</span>}
              {r.category_name && <span className="category-tag" style={{ background: (r.category_color || '#3B82F6') + '20', color: r.category_color || '#3B82F6' }}>{r.category_name}</span>}
              {r.priority_name && <span className="priority-badge" style={{ background: (r.priority_color || '#6B7280') + '20', color: r.priority_color || '#6B7280' }}>{r.priority_name}</span>}
              {r.status_name && <span className="status-badge" style={{ background: (r.status_color || '#6B7280') + '20', color: r.status_color || '#6B7280' }}>{r.status_name}</span>}
              <span className="search-result-date">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function UserSection({ data, onNavigate }) {
  const { t } = useTranslation();
  if (!data || data.total === 0) return null;
  return (
    <div className="search-results-section">
      <div className="search-results-section-header">{t('search.usersCount', { count: data.total })}</div>
      <div className="search-results-table">
        {data.items.map(u => (
          <button key={u.id} className="search-result-row" onClick={() => onNavigate('/users')}>
            <div className="search-result-row-main">
              <span className="global-search-avatar" style={{ background: getRoleColor(u.role), overflow: 'hidden' }}>{getAvatarUrl(u.avatar) ? <img src={getAvatarUrl(u.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.name || '?').charAt(0)}</span>
              <span className="search-result-title">{u.name}</span>
              <span className="role-badge" style={{ background: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>{t('role.' + u.role)}</span>
            </div>
            <div className="search-result-row-meta">
              <span>{u.email}</span>
              {u.company_name && <span>{u.company_name}</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function GroupSection({ data, onNavigate }) {
  const { t } = useTranslation();
  if (!data || data.total === 0) return null;
  return (
    <div className="search-results-section">
      <div className="search-results-section-header">{t('search.groupsCount', { count: data.total })}</div>
      <div className="search-results-table">
        {data.items.map(g => (
          <button key={g.id} className="search-result-row" onClick={() => onNavigate('/groups')}>
            <div className="search-result-row-main">
              <span className="global-search-avatar" style={{ background: g.color || '#6B7280' }}>{g.name.charAt(0)}</span>
              <span className="search-result-title">{g.name}</span>
            </div>
            <div className="search-result-row-meta">
              <span>{g.company_name || '—'}</span>
              <span>{t('search.memberCount', { count: g.memberCount || 0 })}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GlobalSearchResults({ clientMode = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const q = searchParams.get('q') || '';
  const type = searchParams.get('type') || 'all';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';
  const requestBase = clientMode ? '/client/requests' : '/requests';
  const searchPath = clientMode ? '/client/search' : '/search';

  useEffect(() => {
    saveSearchQuery(q);
  }, [q]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const effectivePage = type === 'all' ? 1 : page;
    const timer = setTimeout(() => {
      api.get(`/api/search?q=${encodeURIComponent(q)}&type=${type}&page=${effectivePage}&limit=10`)
        .then(setData)
        .catch(err => setError(t('search.failedSearch') + ': ' + err.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [q, type, page]);

  const availableTypes = [
    { key: 'all', label: t('search.allResults') },
    { key: 'requests', label: t('search.requests') },
    ...(isAdmin ? [
      { key: 'users', label: t('search.users') },
      { key: 'groups', label: t('search.groups') }
    ] : [])
  ];

  const setType = useCallback((t) => {
    setSearchParams({ q, type: t, page: '1' });
  }, [q, setSearchParams]);

  const setPage = useCallback((p) => {
    setSearchParams({ q, type, page: String(p) });
  }, [q, type, setSearchParams]);

  const onNavigate = useCallback((path) => navigate(path), [navigate]);

  if (!q.trim()) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>{t('search.title')}</h1>
            <p>{t('search.subtitle')}</p>
          </div>
        </div>
        <div className="chart-card">
          <div className="empty-state">{t('search.emptyPrompt')}</div>
        </div>
      </div>
    );
  }

  const requestsSection = type === 'all' || type === 'requests' ? data?.results?.requests : null;
  const usersSection = type === 'all' || type === 'users' ? data?.results?.users : null;
  const groupsSection = type === 'all' || type === 'groups' ? data?.results?.groups : null;

  const sectionTotal = requestsSection?.total || 0;
  const totalForPagination = type === 'requests' ? (data?.results?.requests?.total || 0)
    : type === 'users' ? (data?.results?.users?.total || 0)
    : type === 'groups' ? (data?.results?.groups?.total || 0)
    : 0;
  const totalPages = Math.max(1, Math.ceil(totalForPagination / 10));

  const hasAnyResults = data
    ? (data.results?.requests?.total || 0) + (data.results?.users?.total || 0) + (data.results?.groups?.total || 0) > 0
    : false;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{t('search.resultsTitle')}</h1>
          <p>{t('search.resultsFor', { query: q })}</p>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      <div className="search-results-tabs">
        {availableTypes.map(tp => (
          <button
            key={tp.key}
            className={`search-results-tab ${type === tp.key ? 'active' : ''}`}
            onClick={() => setType(tp.key)}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          {!hasAnyResults ? (
            <div className="empty-state">{t('search.noResults')}</div>
          ) : (
            <>
              {type === 'all' ? (
                <>
                  <RequestSection title={t('search.requests')} data={requestsSection} requestBase={requestBase} onNavigate={onNavigate} />
                  <UserSection data={usersSection} onNavigate={onNavigate} />
                  <GroupSection data={groupsSection} onNavigate={onNavigate} />
                </>
              ) : type === 'users' ? (
                <UserSection data={usersSection} onNavigate={onNavigate} />
              ) : type === 'groups' ? (
                <GroupSection data={groupsSection} onNavigate={onNavigate} />
              ) : (
                <RequestSection title={t('search.requests')} data={requestsSection} requestBase={requestBase} onNavigate={onNavigate} />
              )}
              {type !== 'all' && (
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
