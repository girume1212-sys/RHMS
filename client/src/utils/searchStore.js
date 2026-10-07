const STORAGE_KEY = 'rhms_global_search_query';

export function getSavedSearchQuery() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveSearchQuery(q) {
  try {
    sessionStorage.setItem(STORAGE_KEY, q);
  } catch (e) {}
}
