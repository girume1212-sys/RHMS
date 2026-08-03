import React from 'react';
import { useTranslation } from '../i18n/useTranslation';

export default function Pagination({ totalItems, page, setPage, perPage, setPerPage }) {
  const { t } = useTranslation();
  const totalPages = Math.ceil(totalItems / perPage);
  const start = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalItems);

  return (
    <>
      <div className="table-footer">
        <div className="table-info">
          <div className="per-page-select">
            <label>{t('common.rowsPerPage')}</label>
            <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
              {[5, 10, 15, 20, 25, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <span>{t('common.showingRange', { start, end, total: totalItems })}</span>
        </div>
      </div>
      <div className="table-pagination">
        <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>{t('common.prev')}</button>
        {Array.from({ length: totalPages || 1 }, (_, i) => {
          const p = i + 1;
          if (totalPages > 7) {
            if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
              return <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
            }
            if (p === page - 2 || p === page + 2) {
              return <button key={p} className="page-btn" disabled>...</button>;
            }
            return null;
          }
          return <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
        })}
        <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</button>
      </div>
    </>
  );
}
