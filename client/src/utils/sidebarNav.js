import { useEffect, useRef } from 'react';
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

const PREV_MENU_KEY = 'rhms_prevMenu';

function setPrevMenu(path) {
  try { sessionStorage.setItem(PREV_MENU_KEY, path); } catch (e) {}
}

function clearPrevMenu() {
  try { sessionStorage.removeItem(PREV_MENU_KEY); } catch (e) {}
}

function getPrevMenu() {
  try { return sessionStorage.getItem(PREV_MENU_KEY); } catch (e) { return null; }
}

function isMenuPath(pathname, menuPaths) {
  return menuPaths.find(p => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p + '/');
  });
}

/**
 * Tracks the sidebar menu that was active before the current one and stores it
 * in sessionStorage so the Back buttons can return to the previously opened
 * menu (and the sidebar highlight follows along).
 */
export function useTrackPrevMenu(menuPaths) {
  const location = useLocation();
  const prevActiveRef = useRef(null);

  useEffect(() => {
    const menuPath = isMenuPath(location.pathname, menuPaths);
    if (menuPath) {
      if (prevActiveRef.current && prevActiveRef.current !== menuPath) {
        setPrevMenu(prevActiveRef.current);
      }
      prevActiveRef.current = menuPath;
    }
  }, [location.pathname, menuPaths]);
}

export function getMenuAbove(menuPath) {
  const idx = SIDEBAR_MENUS.indexOf(menuPath);
  if (idx <= 0) return '/';
  return SIDEBAR_MENUS[idx - 1];
}

/**
 * Back button that remembers the previously active menu and navigates upward
 * to that parent page (so the sidebar highlight follows). Falls back to a
 * deterministic target when no active menu was recorded (direct URL entry).
 */
export function useBackNavigation(targetPath) {
  const navigate = useNavigate();
  return () => {
    const prev = getPrevMenu();
    if (prev) {
      clearPrevMenu();
      navigate(prev);
    } else {
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
    const prev = getPrevMenu();
    if (prev) {
      clearPrevMenu();
      navigate(prev);
    } else {
      navigate(fallbackPath);
    }
  };
}
