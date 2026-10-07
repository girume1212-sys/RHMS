import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import Icon from './Icon';

const LANG_OPTIONS = [
  { code: 'en', label: '🇺🇸 English' },
  { code: 'am', label: '🇪🇹 አማርኛ' },
];

export default function LanguageSelector({ variant = 'dropdown' }) {
  const { language, changeLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const current = LANG_OPTIONS.find(o => o.code === language) || LANG_OPTIONS[0];

  const handleSelect = (code) => {
    changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className={`lang-selector lang-selector-${variant}`} ref={ref}>
      <button type="button" className="lang-selector-btn" onClick={() => setOpen(!open)} title="Language / ቋንቋ">
        <span className="lang-selector-icon"><Icon name="globe" size={16} /></span>
        <span className="lang-selector-current">{current.code === 'en' ? 'EN' : 'አማ'}</span>
        <span className="dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="lang-selector-menu">
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.code}
              type="button"
              className={`lang-selector-item ${opt.code === language ? 'active' : ''}`}
              onClick={() => handleSelect(opt.code)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
