import React, { useState, useRef, useEffect } from 'react';

export default function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const label = dateFrom && dateTo
    ? `${formatDate(dateFrom)} - ${formatDate(dateTo)}`
    : dateFrom
    ? `${formatDate(dateFrom)} - End`
    : dateTo
    ? `Start - ${formatDate(dateTo)}`
    : 'Select date range';

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ dateFrom: '', dateTo: '' });
  };

  return (
    <div className="drp-container" ref={ref}>
      <button className="drp-trigger" onClick={() => setOpen(!open)}>
        <span className="drp-icon">📅</span>
        <span className={`drp-label ${!dateFrom && !dateTo ? 'placeholder' : ''}`}>{label}</span>
        <span className={`drp-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="drp-dropdown">
          <div className="drp-row">
            <div className="drp-field">
              <label>From</label>
              <input type="date" value={dateFrom || ''} onChange={e => onChange({ dateFrom: e.target.value, dateTo })} />
            </div>
            <span className="drp-separator">→</span>
            <div className="drp-field">
              <label>To</label>
              <input type="date" value={dateTo || ''} onChange={e => onChange({ dateFrom, dateTo: e.target.value })} />
            </div>
          </div>
          <div className="drp-actions">
            <button className="drp-clear" onClick={handleClear}>Clear</button>
            <button className="drp-apply" onClick={() => setOpen(false)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
