import React from 'react';
import { useTranslation } from '../i18n/useTranslation';
import PageNumbers from './PageNumbers';

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
        <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
        <button className="page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('common.next')}</button>
      </div>
    </>
  );
}
