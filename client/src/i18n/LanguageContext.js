import React, { createContext, useContext, useState, useEffect } from 'react';
import en from './en.json';
import am from './am.json';

const translations = { en, am };
const SUPPORTED = ['en', 'am'];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('rhms_language');
    return saved && translations[saved] ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('rhms_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (langCode) => {
    if (SUPPORTED.includes(langCode)) {
      setLanguage(langCode);
    }
  };

  const t = (key, params) => {
    const keys = key.split('.');
    let value = translations[language] || translations.en;
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    let str = typeof value === 'string' ? value : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      }
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
