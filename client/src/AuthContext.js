import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('rhms_token'));
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('rhms_darkMode') === 'true');

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      localStorage.setItem('rhms_darkMode', !prev);
      return !prev;
    });
  };

  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  const fetchUser = useCallback(async (tokenStr) => {
    try {
      const res = await fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: `Bearer ${tokenStr}` }
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUser(data);
      setLoading(false);
    } catch {
      localStorage.removeItem('rhms_token');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchUser(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = async (email, password) => {
    let res;
    try {
      res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch (err) {
      throw new Error('Cannot connect to server. Is the backend running on port 5000?');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem('rhms_token', data.token);
    setUser(data.user);
    setToken(data.token);
    setLoading(false);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('rhms_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, darkMode, toggleDarkMode, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
