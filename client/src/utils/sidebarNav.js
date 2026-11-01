import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const SIDEBAR_MENUS = [
  '/',
  '/requests',
  '/users',
  '/categories',
  '/company',
  '/groups',
  '/feedback',
  '/reports',
  '/activity',
  '/settings'
];

const HISTORY_KEY = 'rhms_menuHistory';

function getHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(p => typeof p === 'string') : [];
  } catch (e) { return []; }
}

function setHistory(arr) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch (e) {}
}


export function useTrackPrevMenu(menuPaths) {
  const location = useLocation();

  useEffect(() => {
    const menuPath = isMenuPath(location.pathname, menuPaths);
    if (menuPath) {
      const history = getHistory();
      if (history[history.length - 1] !== menuPath) {
        setHistory([...history, menuPath]);
      }
    }
  }, [location.pathname, menuPaths]);
}

function isMenuPath(pathname, menuPaths) {
  return menuPaths.find(p => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p + '/');
  });
}


export function getMenuAbove(menuPath) {
  const idx = SIDEBAR_MENUS.indexOf(menuPath);
  if (idx <= 0) return '/';
  return SIDEBAR_MENUS[idx - 1];
}


export function useBackNavigation(targetPath) {
  const navigate = useNavigate();
  return () => {
    const history = getHistory();
    if (history.length >= 2) {
      const parent = history[history.length - 2];
      setHistory(history.slice(0, -1));
      navigate(parent);
    } else {
      setHistory([targetPath]);
      navigate(targetPath);
    }
  };
}


export function usePageBack(fallbackPath) {
  const navigate = useNavigate();
  return () => {
    const history = getHistory();
    if (history.length >= 2) {
      const parent = history[history.length - 2];
      setHistory(history.slice(0, -1));
      navigate(parent);
    } else {
      setHistory([fallbackPath]);
      navigate(fallbackPath);
    }
  };
}