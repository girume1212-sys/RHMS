import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import Toast from './Toast';
import { showStatusToast } from '../notify';

export default function Feedback() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => { loadFeedback(); }, []);

  const loadFeedback = () => {
    setError('');
    setLoading(true);
    api.get('/api/feedback').then(data => {
      setFeedback(data);
      setLoading(false);
    }).catch(err => { setError('Failed to load feedback: ' + err.message); setLoading(false); });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/feedback/${id}`);
      loadFeedback();
      addToast('Feedback deleted successfully!');
      showStatusToast('Feedback deleted', 'request_deleted');
      setDeleteTarget(null);
    } catch (err) {
      setError('Failed to delete feedback: ' + err.message);
      addToast('Failed to delete feedback: ' + err.message, 'error');
      setDeleteTarget(null);
    }
  };

  const handleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const renderStars = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const filtered = feedback.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (f.user_name || '').toLowerCase().includes(q) ||
      (f.request_subject || '').toLowerCase().includes(q) ||
      (f.comment || '').toLowerCase().includes(q) ||
      (f.request_id || '').toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (!sort.key) return 0;
    let aVal, bVal;
    switch (sort.key) {
      case 'rating': aVal = a.rating || 0; bVal = b.rating || 0; break;
      case 'user_name': aVal = (a.user_name || '').toLowerCase(); bVal = (b.user_name || '').toLowerCase(); break;
      case 'request_subject': aVal = (a.request_subject || '').toLowerCase(); bVal = (b.request_subject || '').toLowerCase(); break;
      case 'created_at': aVal = a.created_at || ''; bVal = b.created_at || ''; break;
      default: return 0;
    }
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const getSortIcon = (key) => {
    const isActive = sort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
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
          <button className="back-link" onClick={() => window.history.back()}>← Back</button>
          <h1>Feedback</h1>
          <p>View all user ratings and feedback on resolved requests</p>
        </div>
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

      {loading ? (
        <div className="loading-screen"><div className="spinner"></div></div>
      ) : (
        <div className="chart-card">
          <div className="table-header-bar">
            <h3>Feedback ({filtered.length})</h3>
            <div className="table-header-actions">
              <div className="table-search-box">
                <span className="search-icon"></span>
                <input type="text" placeholder="Search feedback..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
              </div>
            </div>
          </div>

          <div className="table-card" style={{ boxShadow: 'none', padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th className="sortable" onClick={() => handleSort('rating')}>Rating {getSortIcon('rating')}</th>
                  <th>Comment</th>
                  <th className="sortable" onClick={() => handleSort('user_name')}>User {getSortIcon('user_name')}</th>
                  <th className="sortable" onClick={() => handleSort('request_subject')}>Request {getSortIcon('request_subject')}</th>
                  <th className="sortable" onClick={() => handleSort('created_at')}>Date {getSortIcon('created_at')}</th>
                  <th style={{ width: '80px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((f, i) => (
                  <tr key={f.id}>
                    <td><span style={{ fontSize: '13px', fontWeight: '600' }}>{(page - 1) * perPage + i + 1}</span></td>
                    <td><span style={{ color: '#F59E0B', fontSize: '16px', letterSpacing: '2px' }}>{renderStars(f.rating)}</span></td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.comment || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>{f.user_name || <span style={{ color: '#9ca3af' }}>Anonymous</span>}</td>
                    <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.request_subject
                        ? <a href={`/requests/${f.request_id}`} style={{ color: '#3B82F6', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.location.href = `/requests/${f.request_id}`; }}>{f.request_subject}</a>
                        : <span style={{ color: '#9ca3af' }}>{f.request_id}</span>}
                    </td>
                    <td>{new Date(f.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="action-btn-text delete" onClick={() => setDeleteTarget(f)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>No feedback found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <div className="table-footer-info">
              <span>Show</span>
              <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span>of {filtered.length} feedback</span>
            </div>
            <div className="table-pagination">
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>›</button>
              <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}
               style={{ maxWidth: '400px', textAlign: 'center', background: '#1e293b' }}>
            <p style={{ fontSize: 18, color: '#fff', lineHeight: 1.6, margin: '32px 24px 24px' }}>
              Are you sure you want to delete this feedback?
            </p>
            <p style={{ color: '#F59E0B', fontSize: '24px', letterSpacing: '4px', marginBottom: '8px' }}>
              {renderStars(deleteTarget.rating)}
            </p>
            {deleteTarget.comment && (
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px', padding: '0 24px' }}>
                "{deleteTarget.comment}"
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '0 24px 32px' }}>
              <button onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button onClick={() => handleDelete(deleteTarget.id)}
                      style={{ background: '#EF4444' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
