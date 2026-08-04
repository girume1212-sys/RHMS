import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTranslation } from '../i18n/useTranslation';
import PageNumbers from './PageNumbers';
import Icon from './Icon';

export default function DatabaseTables() {
  const { t } = useTranslation();
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [sort, setSort] = useState({ key: '', dir: 'asc' });

  useEffect(() => {
    api.get('/api/db-tables')
      .then(data => { setTables(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadTable = (tableName) => {
    setSelectedTable(tableName);
    setLoadingTable(true);
    setPage(1);
    api.get(`/api/db-tables/${tableName}`)
      .then(data => { setTableData(data); setLoadingTable(false); })
      .catch(() => setLoadingTable(false));
  };

  const formatDate = (val) => {
    if (!val) return '-';
    if (typeof val === 'string' && val.includes('T')) {
      return new Date(val).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const truncate = (val, max = 50) => {
    if (val === null || val === undefined) return '-';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.length > max ? str.substring(0, max) + '...' : str;
  };

  const handleSort = (key) => {
    setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
  };

  const getSortIcon = (key) => {
    const isActive = sort.key === key;
    if (!isActive) return <span className="sort-icon" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>⇅</span>;
    return <span className="sort-icon active" onClick={(e) => { e.stopPropagation(); handleSort(key); }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>;
  };

  const getSortValue = (row, key) => {
    const val = row[key];
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return String(val).toLowerCase();
  };

  const sortedRows = tableData ? [...tableData.rows].sort((a, b) => {
    if (!sort.key) return 0;
    const aVal = getSortValue(a, sort.key);
    const bVal = getSortValue(b, sort.key);
    if (aVal < bVal) return sort.dir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  }) : [];

  const totalPages = Math.ceil(sortedRows.length / perPage);
  const paginated = sortedRows.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <button className="back-link" onClick={() => window.history.back()}>← {t('common.back')}</button>
          <h1>{t('system.databaseTables')}</h1>
          <p>{t('system.databaseTablesSubtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
        <div className="table-card" style={{ width: '240px', flexShrink: 0, padding: '12px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', padding: '8px 12px', margin: 0, borderBottom: '1px solid #e5e7eb' }}>
            {t('system.tablesCount', { count: tables.length })}
          </h3>
          {loading ? (
            <div className="loading-screen" style={{ padding: '40px 0' }}><div className="spinner"></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 0' }}>
              {tables.map(t => (
                <button
                  key={t}
                  onClick={() => loadTable(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    textAlign: 'left',
                    background: selectedTable === t ? '#EFF6FF' : 'transparent',
                    color: selectedTable === t ? '#2563EB' : '#374151',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => { if (selectedTable !== t) e.target.style.background = '#f9fafb'; }}
                  onMouseOut={(e) => { if (selectedTable !== t) e.target.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'inline-flex' }}><Icon name="table" size={16} /></span>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chart-card" style={{ flex: 1, overflow: 'hidden' }}>
          {!selectedTable ? (
            <div className="empty-state">
              <div style={{ fontSize: '48px', marginBottom: '16px' }}><Icon name="database" size={48} /></div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>{t('system.selectTableToView')}</h3>
              <p>{t('system.selectTableHint')}</p>
            </div>
          ) : loadingTable ? (
            <div className="loading-screen"><div className="spinner"></div></div>
          ) : tableData ? (
            <div>
              <div className="table-header-bar">
                <div>
                  <h3 style={{ margin: 0 }}>{selectedTable}</h3>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                    {t('system.rowsColumns', { rows: tableData.count, columns: tableData.columns.length })}
                  </p>
                </div>
                <span style={{ padding: '4px 12px', background: '#f0fdf4', color: '#16a34a', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                  {t('system.connected')}
                </span>
              </div>

              <div className="table-card" style={{ boxShadow: 'none', padding: 0, border: 'none' }}>
                <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: 'calc(100vh - 350px)' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {tableData.columns.map(col => (
                          <th key={col.column_name} className="sortable">
                            <span>{col.column_name} {getSortIcon(col.column_name)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((row, i) => (
                        <tr key={i}>
                          {tableData.columns.map(col => (
                            <td key={col.column_name} style={{ maxWidth: '200px' }}>
                              <span title={String(row[col.column_name])} style={{ cursor: 'default' }}>
                                {formatDate(row[col.column_name])}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                      {paginated.length === 0 && (
                        <tr><td colSpan={tableData.columns.length} style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>{t('common.noData')}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-footer">
                <div className="table-footer-info">
                  <span>{t('common.show')}</span>
                  <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>{t('common.ofRows', { count: sortedRows.length })}</span>
                </div>
                <div className="table-pagination">
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                  <button className="page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>
                  <PageNumbers page={page} totalPages={totalPages} onPageChange={setPage} />
                  <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(page + 1)}>›</button>
                  <button className="page-btn" disabled={page === totalPages || totalPages === 0} onClick={() => setPage(totalPages)}>»</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">{t('system.failedToLoadTableData')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
