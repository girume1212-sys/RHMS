import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { api } from '../api';
import { getSavedSearchQuery, saveSearchQuery } from '../utils/searchStore';
import { useTranslation } from '../i18n/useTranslation';
import { transSeeded } from '../i18n/translateServer';
import Icon from './Icon';

export default function GlobalSearch({ clientMode = false, placeholder }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [query, setQuery] = useState(getSavedSearchQuery());
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const isAdmin = user?.role === 'admin';
  const searchPath = clientMode ? '/client/search' : '/search';
  const requestBase = clientMode ? '/client/requests' : '/requests';

  const runSearch = useCallback((q) => {
    if (!q.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get(`/api/search?q=${encodeURIComponent(q.trim())}&limit=5`)
      .then(data => setResults(data.results))
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    saveSearchQuery(v);
    setOpen(true);
  };

  const handleClear = () => {
    setQuery('');
    saveSearchQuery('');
    setResults(null);
    setOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const goToResults = (type = 'all') => {
    if (!query.trim()) return;
    setOpen(false);
    navigate(`${searchPath}?q=${encodeURIComponent(query.trim())}&type=${type}`);
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goToResults('all');
  };

  const totalResults = results
    ? (results.requests?.total || 0) + (results.users?.total || 0) + (results.groups?.total || 0)
    : 0;
  const showEmpty = !loading && query.trim() && results && totalResults === 0;
  const showPanel = open && query.trim() && (loading || results);

  return (
    <form className="global-search" onSubmit={handleSubmit} ref={containerRef}>
      <div className="global-search-input-wrap">
        <span className="global-search-icon"><Icon name="search" /></span>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder || t('search.placeholder')}
          value={query}
          onChange={handleChange}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          aria-label={t('search.ariaLabel')}
        />
        {query && (
          <button type="button" className="global-search-clear" onClick={handleClear} title={t('search.clearTitle')}>×</button>
        )}
      </div>

      {showPanel && (
        <div className="global-search-dropdown">
          {loading && <div className="global-search-message">{t('search.searching')}</div>}
          {!loading && results && (
            <>
              {results.requests?.total > 0 && (
                <div className="global-search-section">
                  <div className="global-search-section-header">
                    <span>{t('search.requestsCount', { count: results.requests.total })}</span>
                    <button type="button" className="global-search-see-all" onClick={() => goToResults('requests')}>{t('search.seeAll')}</button>
                  </div>
                  <div className="global-search-section-list">
                    {results.requests.items.map(r => (
                      <button type="button" key={r.id} className="global-search-item" onClick={() => goTo(`${requestBase}/${r.id}`)}>
                        <span className="global-search-item-title">
                          <strong>REQ-{String(r.id).padStart(4, '0')}</strong> {r.subject}
                        </span>
                        <span className="global-search-item-meta">
                          {r.client_name && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="user" size={13} /> {r.client_name}</span>}
                          {r.status_name && <span className="status-badge" style={{ background: (r.status_color || '#6B7280') + '20', color: r.status_color || '#6B7280' }}>{transSeeded(r.status_name, 'status', t)}</span>}
                          {r.priority_name && <span className="priority-badge" style={{ background: (r.priority_color || '#6B7280') + '20', color: r.priority_color || '#6B7280' }}>{r.priority_name}</span>}
                          {r.category_name && <span className="category-tag" style={{ background: (r.category_color || '#3B82F6') + '20', color: r.category_color || '#3B82F6' }}>{r.category_name}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && results.users?.total > 0 && (
                <div className="global-search-section">
                  <div className="global-search-section-header">
                    <span>{t('search.usersCount', { count: results.users.total })}</span>
                    <button type="button" className="global-search-see-all" onClick={() => goToResults('users')}>{t('search.seeAll')}</button>
                  </div>
                  <div className="global-search-section-list">
                    {results.users.items.map(u => (
                      <button type="button" key={u.id} className="global-search-item" onClick={() => goTo('/users')}>
                        <span className="global-search-item-title">
                          <span className="global-search-avatar" style={{ background: u.role === 'admin' ? '#EF4444' : u.role === 'support' ? '#3B82F6' : u.role === 'developer' ? '#8B5CF6' : '#10B981' }}>
                            {(u.name || '?').charAt(0)}
                          </span>
                          {u.name}
                        </span>
                        <span className="global-search-item-meta">
                          <span>{u.email}</span>
                          <span className="role-badge" style={{ background: (u.role === 'admin' ? '#EF4444' : u.role === 'support' ? '#3B82F6' : u.role === 'developer' ? '#8B5CF6' : '#10B981') + '20', color: u.role === 'admin' ? '#EF4444' : u.role === 'support' ? '#3B82F6' : u.role === 'developer' ? '#8B5CF6' : '#10B981' }}>
                            {t('role.' + u.role)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && results.groups?.total > 0 && (
                <div className="global-search-section">
                  <div className="global-search-section-header">
                    <span>{t('search.groupsCount', { count: results.groups.total })}</span>
                    <button type="button" className="global-search-see-all" onClick={() => goToResults('groups')}>{t('search.seeAll')}</button>
                  </div>
                  <div className="global-search-section-list">
                    {results.groups.items.map(g => (
                      <button type="button" key={g.id} className="global-search-item" onClick={() => goTo('/groups')}>
                        <span className="global-search-item-title">
                          <span className="global-search-avatar" style={{ background: g.color || '#6B7280' }}>{g.name.charAt(0)}</span>
                          {g.name}
                        </span>
                        <span className="global-search-item-meta">
                          <span>{g.company_name || '—'}</span>
                          <span>{t('search.memberCount', { count: g.memberCount || 0 })}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showEmpty && (
                <div className="global-search-empty">{t('search.noResults')}</div>
              )}

              {!showEmpty && totalResults > 0 && (
                <div className="global-search-footer">
                  <button type="button" onClick={() => goToResults('all')}>{t('search.viewAllResults')}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </form>
  );
}
