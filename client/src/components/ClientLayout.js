import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { API_BASE } from '../api';

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  return `${API_BASE}${avatar}`;
};

export default function ClientLayout() {
  const { t } = useTranslation();
  const { user, logout, darkMode, toggleDarkMode, systemName, systemLogo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bubbleNotifications, setBubbleNotifications] = useState([]);
  const eventSourceRef = useRef(null);
  const dismissedIds = useRef(new Set());
  const newNotifIds = useRef(new Set());
  const audioUnlocked = useRef(false);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlocked.current) return;
      try {
        const testAudio = new Audio('data:audio/wav;base64,UklGRl9vT19teleXAVlbmFtZQABAAEARKwAAIhYAQACABAAZGF0YQ==');
        testAudio.volume = 0.3;
        testAudio.play().then(() => {
          audioUnlocked.current = true;
        }).catch(() => {});
      } catch (e) {}
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVggoKIeGBGPX2Qn6l5Zk9Ff4yZpHtqVU6DkJyif3BdVoiQnJ98c2FajI+XoHx1ZmCWkJOeendpZZyXmJt4dmtopJqXmXl5bGulmpeYeng=');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
      if (!e.target.closest('.notification-container')) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationIcon = useCallback((type) => {
    const icons = { status_change: '🔄', assigned: '👤', comment: '💬', request_created: '📋', request_deleted: '🗑️', default: '🔔' };
    return icons[type] || icons.default;
  }, []);

  const getNotificationType = useCallback((msg) => {
    if (!msg) return 'default';
    const lower = msg.toLowerCase();
    if (lower.includes('comment')) return 'comment';
    if (lower.includes('status')) return 'status';
    if (lower.includes('assigned') || lower.includes('assign')) return 'assignment';
    return 'default';
  }, []);

  const removeBubble = useCallback((id) => {
    dismissedIds.current.add(id);
    setBubbleNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // SSE real-time notifications
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('rhms_token');
    if (!token) return;

    let reconnectTimeout = null;

    function connectSSE() {
      const eventSource = new EventSource(`${API_BASE}/api/notifications/stream?token=${token}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'init') {
            return;
          }

          if (data.message === 'Connected') return;

          const notification = {
            id: Date.now(),
            type: data.data?.type || 'default',
            message: data.message,
            requestId: data.data?.requestId,
            timestamp: data.timestamp
          };

          setNotifications(prev => [notification, ...prev].slice(0, 20));

          if (!dismissedIds.current.has(notification.id) && notification.userId !== user.id) {
            setBubbleNotifications(prev => [notification, ...prev].slice(0, 5));
            setTimeout(() => removeBubble(notification.id), 2000);
          }
          newNotifIds.current.add(notification.id);
          setUnreadCount(prev => prev + 1);

          if (data.data?.type === 'claimed' && data.data?.assignee !== user.id) {
            window.dispatchEvent(new CustomEvent('refresh-requests'));
          }

          playNotificationSound();

        } catch (e) {
          console.error('SSE parse error:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        reconnectTimeout = setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            connectSSE();
          }
        }, 3000);
      };
    }

    connectSSE();

    return () => {
      clearTimeout(reconnectTimeout);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user, playNotificationSound]);

  // Status toast listener
  const [statusToast, setStatusToast] = useState(null);
  const statusToastTimeout = useRef(null);

  useEffect(() => {
    const handleStatusToast = (e) => {
      const { message, type } = e.detail;
      if (statusToastTimeout.current) clearTimeout(statusToastTimeout.current);
      setStatusToast({ message, type });
      statusToastTimeout.current = setTimeout(() => setStatusToast(null), 2000);
    };
    window.addEventListener('status-toast', handleStatusToast);
    return () => {
      window.removeEventListener('status-toast', handleStatusToast);
      if (statusToastTimeout.current) clearTimeout(statusToastTimeout.current);
    };
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
    newNotifIds.current.clear();
  }, []);

  const menuItems = [
    { path: '/client', label: t('common.dashboard'), icon: '🏠' },
    { path: '/client/requests', label: t('common.myRequests'), icon: '📄' },
    { path: '/client/activity', label: t('common.activityLog'), icon: '📝' },
    { path: '/client/profile', label: t('common.myProfile'), icon: '👤' },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            {systemLogo ? (
              <img src={`${API_BASE}${systemLogo}`} alt="Logo" className="sidebar-logo" />
            ) : (
              <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="#7c3aed"/>
                <path d="M16 18C16 15.79 17.79 14 20 14H28C30.21 14 32 15.79 32 18V22C32 24.21 30.21 26 28 26H20C17.79 26 16 24.21 16 22V18Z" fill="white"/>
                <circle cx="24" cy="32" r="4" fill="white"/>
                <path d="M20 36H28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            {sidebarOpen && (
              <div>
                <h2>{systemName}</h2>
                <span>{t('common.clientPortal')}</span>
              </div>
            )}
          </div>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar-small" style={{ background: '#7c3aed', overflow: 'hidden' }}>
            {getAvatarUrl(user?.avatar) ? <img src={getAvatarUrl(user?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.name?.charAt(0) || 'U')}
          </div>
          {sidebarOpen && (
            <div className="user-info-small">
              <span className="user-name-small">{user?.name}</span>
              <span className="user-role-small">{t('common.client')}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Bubble Notifications */}
      {bubbleNotifications.map((n) => (
        <div
          key={n.id}
          className={`notification-bubble bubble-type-${n.type || getNotificationType(n.message)} bubble-incoming`}
          onClick={() => { if (n.requestId) navigate(`/client/requests/${n.requestId}`); removeBubble(n.id); }}
        >
          <div className="bubble-pill">
            <button className="bubble-pill-close" onClick={(e) => { e.stopPropagation(); removeBubble(n.id); }}>✕</button>
            <div className="bubble-pill-icon">
              {getNotificationIcon(n.type)}
            </div>
            <div className="bubble-pill-body">
              <div className="bubble-pill-title">{n.requestId ? `Request #${n.requestId}` : t('common.notifications')}</div>
              <div className="bubble-pill-text">{n.message}</div>
              <div className="bubble-pill-time">{n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : ''}</div>
            </div>
          </div>
        </div>
      ))}
      {statusToast && (
        <div className={`status-toast status-toast-${statusToast.type}`}>
          <span className="status-toast-icon">{statusToast.type === 'success' ? '✓' : statusToast.type === 'error' ? '✕' : 'ℹ'}</span>
          <span className="status-toast-message">{statusToast.message}</span>
        </div>
      )}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="search-box">
              <span className="search-icon" style={{ cursor: 'pointer' }} onClick={() => { if (searchQuery.trim()) navigate(`${location.pathname}?search=${encodeURIComponent(searchQuery.trim())}`); }}>🔍</span>
              <input
                type="text"
                placeholder="Search requests, users, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`${location.pathname}?search=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
              />
            </div>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              {darkMode ? <><span className="toggle-icon">☀️</span><span>{t('common.brightMode')}</span></> : <><span className="toggle-icon">🌙</span><span>{t('common.darkMode')}</span></>}
            </button>
            <div className="notification-container" style={{ position: 'relative' }}>
              <button className="theme-toggle" onClick={() => { setShowNotifications(!showNotifications); if (!showNotifications) clearUnreadCount(); }} title="Notifications" style={{ position: 'relative' }}>
                <span className="toggle-icon">🔔</span>
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: darkMode ? '#1e293b' : '#fff', borderRadius: 12, boxShadow: darkMode ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.15)', width: 360, maxHeight: 400, overflow: 'auto', zIndex: 1000, border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb' }}>
                  <div style={{ padding: '14px 16px', borderBottom: darkMode ? '1px solid #334155' : '1px solid #e5e7eb', fontWeight: 600, fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: darkMode ? '#e2e8f0' : 'inherit' }}>
                    <span>{t('common.notifications')} {unreadCount > 0 && <span style={{ color: '#EF4444', fontWeight: 400 }}>({unreadCount})</span>}</span>
                    {unreadCount > 0 && <span style={{ fontSize: '12px', color: '#3B82F6', cursor: 'pointer' }} onClick={clearUnreadCount}>Clear all</span>}
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{t('common.noNotifications')}</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} style={{ padding: '12px 16px', borderBottom: darkMode ? '1px solid #334155' : '1px solid #f3f4f6', fontSize: 13, cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', background: newNotifIds.current.has(n.id) ? (darkMode ? '#3b1a1a' : '#fef2f2') : 'transparent', borderLeft: newNotifIds.current.has(n.id) ? '3px solid #ef4444' : 'none' }}
                        onClick={() => { setShowNotifications(false); if (n.requestId) navigate(`/client/requests/${n.requestId}`); }}>
                        <div style={{ fontSize: '18px', flexShrink: 0 }}>{getNotificationIcon(n.type)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: darkMode ? '#e2e8f0' : '#1f2937' }}>{n.message}</div>
                          <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="user-menu-container">
              <button className="user-menu-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar-tiny" style={{ background: '#7c3aed', overflow: 'hidden' }}>{getAvatarUrl(user?.avatar) ? <img src={getAvatarUrl(user?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.name?.charAt(0) || 'U')}</div>
                <span>{user?.name}</span>
                <span className="dropdown-arrow">▾</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-avatar" style={{ background: '#7c3aed', overflow: 'hidden' }}>{getAvatarUrl(user?.avatar) ? <img src={getAvatarUrl(user?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.name?.charAt(0)}</div>
                    <div>
                      <div className="dropdown-name">{user?.name}</div>
                      <div className="dropdown-role">{t('common.client')}</div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); navigate('/client/profile'); }}>👤 {t('common.myProfile')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/login'); }}>
                    🚪 {t('common.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
