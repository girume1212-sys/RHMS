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

/**
 * Keeps a stack of visited menus (in sessionStorage) so Back buttons climb one
 * level at a time, remembering the previously active menu and rising back to
 * the dashboard (/ = bottom of the stack).
 */
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

/**
 * Fallback / static parent used either as the final rise above a deep link or
 * the same deterministic target previously relied on.
 */
export function getMenuAbove(menuPath) {
  const idx = SIDEBAR_MENUS.indexOf(menuPath);
  if (idx <= 0) return '/';
  return SIDEBAR_MENUS[idx - 1];
}

/**
 * Back button that climbs the stored menu stack: it remembers the previously
 * active menu, navigates upward to it, and continues upward to the dashboard
 * on repeated clicks (loops are impossible because each click pops the stack).
 */
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

/**
 * Same behaviour for top-level pages (dashboards). fallbackPath is the root.
 */
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