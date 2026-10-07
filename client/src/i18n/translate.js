import en from './en.json';
import am from './am.json';

const translations = { en, am };

export function translate(key, params) {
  const lang = (typeof window !== 'undefined' && localStorage.getItem('rhms_language')) || 'en';
  let value = translations[lang] || translations.en || translations;
  const keys = key.split('.');
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
}
