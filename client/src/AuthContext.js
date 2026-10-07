import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, API_BASE } from './api';
import { useLanguage } from './i18n/LanguageContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { changeLanguage } = useLanguage();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('rhms_token'));
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('rhms_darkMode') === 'true');
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('rhms_themeMode') || 'partial');
  const [systemName, setSystemName] = useState('RHMS');
  const [systemLogo, setSystemLogo] = useState('');
  const timeoutRef = useRef(null);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      localStorage.setItem('rhms_darkMode', !prev);
      return !prev;
    });
  };

  const applyTheme = (mode) => {
    localStorage.setItem('rhms_themeMode', mode);
    setThemeMode(mode);
    const dark = mode === 'dark';
    localStorage.setItem('rhms_darkMode', String(dark));
    setDarkMode(dark);
  };

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
    document.body.classList.toggle('dark-sidebar', themeMode === 'partial' || darkMode);
  }, [darkMode, themeMode]);

  useEffect(() => {
    api.get('/api/settings/public').then(data => {
      if (data.theme === 'light') {
        applyTheme('light');
      } else if (data.theme === 'dark') {
        applyTheme('dark');
      } else if (data.theme === 'partial') {
        localStorage.setItem('rhms_themeMode', 'partial');
        setThemeMode('partial');
      }
      if (data.systemName) setSystemName(data.systemName);
      if (data.systemLogo) setSystemLogo(data.systemLogo);
      if (data.language) {
        localStorage.setItem('rhms_language', data.language);
      }
    }).catch(() => {});
  }, []);

  const resetSessionTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const stored = localStorage.getItem('rhms_sessionTimeout');
    const minutes = stored ? parseInt(stored) : 0;
    if (minutes > 0) {
      timeoutRef.current = setTimeout(() => {
        localStorage.removeItem('rhms_token');
        setToken(null);
        setUser(null);
        window.location.href = '/login?expired=1';
      }, minutes * 60 * 1000);
    }
  }, []);

  useEffect(() => {
    if (token && user) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(e => window.addEventListener(e, resetSessionTimer));
      resetSessionTimer();
      return () => {
        events.forEach(e => window.removeEventListener(e, resetSessionTimer));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
  }, [token, user, resetSessionTimer]);

  const fetchUser = useCallback(async (tokenStr) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data);
      if (data.language) changeLanguage(data.language);
      setLoading(false);
    } catch {
      localStorage.removeItem('rhms_token');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [changeLanguage]);

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (username, email, password) => {
    let res;
    try {
      res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
    } catch (err) {
      throw new Error('Cannot connect to server. Is the backend running on port 5000?');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('rhms_token', data.token);
    if (data.user?.sessionTimeout) {
      localStorage.setItem('rhms_sessionTimeout', String(data.user.sessionTimeout));
    }
    if (data.user?.language) changeLanguage(data.user.language);
    setUser(data.user);
    setToken(data.token);
    setLoading(false);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('rhms_token');
    localStorage.removeItem('rhms_sessionTimeout');
    setToken(null);
    setUser(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, darkMode, toggleDarkMode, themeMode, applyTheme, updateUser, systemName, systemLogo }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
