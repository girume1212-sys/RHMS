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

export function getMenuAbove(menuPath) {
  const idx = SIDEBAR_MENUS.indexOf(menuPath);
  if (idx <= 0) return '/';
  return SIDEBAR_MENUS[idx - 1];
}

export function useBackNavigation(fallbackPath) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };
}