import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import Icon from './Icon';

export default function DateRangePicker({ dateFrom, dateTo, onChange }) {
  const { t } = useTranslation();
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
    ? `${formatDate(dateFrom)} - ${t('common.end')}`
    : dateTo
    ? `${t('common.start')} - ${formatDate(dateTo)}`
    : t('common.selectDateRange');

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ dateFrom: '', dateTo: '' });
  };

  return (
    <div className="drp-container" ref={ref}>
      <button className="drp-trigger" onClick={() => setOpen(!open)}>
        <span className="drp-icon"><Icon name="calendar" size={16} /></span>
        <span className={`drp-label ${!dateFrom && !dateTo ? 'placeholder' : ''}`}>{label}</span>
        <span className={`drp-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="drp-dropdown">
          <div className="drp-row">
            <div className="drp-field">
              <label>{t('common.from')}</label>
              <input type="date" value={dateFrom || ''} onChange={e => onChange({ dateFrom: e.target.value, dateTo })} />
            </div>
            <span className="drp-separator">→</span>
            <div className="drp-field">
              <label>{t('common.to')}</label>
              <input type="date" value={dateTo || ''} onChange={e => onChange({ dateFrom, dateTo: e.target.value })} />
            </div>
          </div>
          <div className="drp-actions">
            <button className="drp-clear" onClick={handleClear}>{t('common.clear')}</button>
            <button className="drp-apply" onClick={() => setOpen(false)}>{t('common.apply')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
