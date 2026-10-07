import React from 'react';

function PageNumbers({ page, totalPages, onPageChange, maxVisible = 4 }) {
  if (!totalPages || totalPages <= 1) return null;
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
      <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
    ));
  }

  const pages = [];
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }

  return pages.map((p, i) =>
    p === '...'
      ? <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
      : <button key={p} className={`page-btn ${page === p ? 'active' : ''}`} onClick={() => onPageChange(p)}>{p}</button>
  );
}

export default PageNumbers;
