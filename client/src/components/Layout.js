import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { api } from '../api';

const API_BASE = 'http://localhost:5000';

export default function Layout() {
  const { user, logout, darkMode, toggleDarkMode, systemName } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bubbleNotifications, setBubbleNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevNotifCount = useRef(0);
  const dismissedIds = useRef(new Set());
  const eventSourceRef = useRef(null);
  const audioUnlocked = useRef(false);
  const notificationAudio = useRef(null);

  // Unlock audio on first user interaction
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlocked.current) return;
      try {
        notificationAudio.current = new Audio('data:audio/wav;base64,UklGRl9vT19teleXAVlbmFtZQABAAEARKwAAIhYAQACABAAZGF0YQ==');
        notificationAudio.current.volume = 0.3;
        notificationAudio.current.play().then(() => {
          audioUnlocked.current = true;
          if (notificationAudio.current) {
            notificationAudio.current.pause();
            notificationAudio.current.currentTime = 0;
          }
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
      if (!e.target.closest('.topbar-icon-container')) {
        setShowNotifications(false);
        setShowMessages(false);
      }
      if (!e.target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getNotificationType = useCallback((msg) => {
    if (!msg) return 'default';
    const lower = msg.toLowerCase();
    if (lower.includes('created') || lower.includes('request') || lower.includes('new')) return 'request';
    if (lower.includes('comment') || lower.includes('replied')) return 'comment';
    if (lower.includes('status') || lower.includes('updated') || lower.includes('changed')) return 'status';
    if (lower.includes('assigned') || lower.includes('assign')) return 'assignment';
    return 'default';
  }, []);

  const getNotificationIcon = useCallback((type) => {
    const icons = { request: '📋', comment: '💬', status: '🔄', assignment: '👤', default: '🔔' };
    return icons[type] || icons.default;
  }, []);

  const removeBubble = useCallback((id) => {
    dismissedIds.current.add(id);
    setBubbleNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const menuItems = [
    { section: null, items: [
      { path: '/', label: t('sidebar.dashboard'), icon: '🏠' },
    ]},
    { section: null, items: [
      { path: '/requests', label: 'All Requests', icon: '📄', roles: ['support'] },
      { path: '/requests', label: t('sidebar.requests'), icon: '📄', roles: ['admin'] },
    ]},
    { section: t('sidebar.management'), items: [
      { path: '/users', label: t('sidebar.users'), icon: '👥', roles: ['admin', 'support'] },
      { path: '/categories', label: t('sidebar.categories'), icon: '📁', roles: ['admin'] },
      { path: '/company', label: 'Company', icon: '🏢', roles: ['admin'] },
      { path: '/groups', label: 'Groups', icon: '👤', roles: ['admin'] },
    ]},
    { section: t('sidebar.reports'), items: [
      { path: '/reports', label: t('sidebar.reportsAnalytics'), icon: '📊', roles: ['admin', 'support'] },
      { path: '/activity', label: t('sidebar.activityLog'), icon: '📝', roles: ['admin', 'support'] },
    ]},
    { section: t('sidebar.settings'), items: [
      { path: '/settings', label: t('sidebar.systemSettings'), icon: '⚙️', roles: ['admin'] },
    ]},
  ];

  const hasPermission = (item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  };

  useEffect(() => {
    api.get('/api/activity').then(data => {
      const newNotifs = data.slice(0, 10);
      setNotifications(newNotifs);
      if (prevNotifCount.current > 0 && newNotifs.length > prevNotifCount.current) {
        const newItems = newNotifs.slice(0, newNotifs.length - prevNotifCount.current);
        newItems.forEach((n, i) => {
          if (!dismissedIds.current.has(n.id)) {
            setTimeout(() => {
              setBubbleNotifications(prev => {
                if (prev.find(p => p.id === n.id)) return prev;
                return [n, ...prev].slice(0, 5);
              });
            }, i * 300);
          }
        });
      }
      prevNotifCount.current = newNotifs.length;
    }).catch(() => {});
    api.get('/api/requests').then(data => {
      const msgs = [];
      data.forEach(r => {
        if (r.comments) {
          r.comments.forEach(c => {
            if (c.userId !== user?.id) {
              msgs.push({ ...c, requestId: r.id, requestSubject: r.subject });
            }
          });
        }
      });
      setMessages(msgs.slice(0, 10));
    }).catch(() => {});
  }, [user]);

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
            setUnreadCount(data.count || 0);
            return;
          }

          if (data.message === 'Connected') return;

          const notification = {
            id: Date.now(),
            type: data.data?.type || 'default',
            message: data.message,
            requestId: data.data?.requestId,
            userId: data.data?.userId,
            timestamp: data.timestamp
          };

          setNotifications(prev => [notification, ...prev].slice(0, 20));

          if (!dismissedIds.current.has(notification.id)) {
            setBubbleNotifications(prev => [notification, ...prev].slice(0, 5));
          }

          setUnreadCount(prev => prev + 1);

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
      statusToastTimeout.current = setTimeout(() => setStatusToast(null), 3000);
    };
    window.addEventListener('status-toast', handleStatusToast);
    return () => {
      window.removeEventListener('status-toast', handleStatusToast);
      if (statusToastTimeout.current) clearTimeout(statusToastTimeout.current);
    };
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const getRoleLabel = (role) => {
    const labels = { admin: t('general.administrator'), support: t('general.escalationTeam'), developer: t('general.developer'), client: t('general.client') };
    return labels[role] || role;
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="24" fill="#1e3a5f"/>
              <path d="M16 18C16 15.79 17.79 14 20 14H28C30.21 14 32 15.79 32 18V22C32 24.21 30.21 26 28 26H20C17.79 26 16 24.21 16 22V18Z" fill="#4da6ff"/>
              <circle cx="24" cy="32" r="4" fill="#4da6ff"/>
              <path d="M20 36H28" stroke="#4da6ff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {sidebarOpen && (
              <div>
                <h2>{systemName || t('general.appName')}</h2>
                <span>{t('general.supportSystem')}</span>
              </div>
            )}
          </div>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((section, si) => (
            <div key={si}>
              {section.section && sidebarOpen && <div className="nav-section">{section.section}</div>}
              {section.items.filter(hasPermission).map((item) => (
                <div key={item.path}>
                  <button
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar-small">
            {user?.name?.charAt(0) || 'U'}
          </div>
          {sidebarOpen && (
            <div className="user-info-small">
              <span className="user-name-small">{user?.name}</span>
              <span className="user-role-small">{getRoleLabel(user?.role)}</span>
            </div>
          )}
        </div>
      </aside>
      {bubbleNotifications.map((n, i) => (
        <div
          key={n.id}
          className={`notification-bubble bubble-type-${n.type || getNotificationType(n.message)} bubble-incoming`}
          onClick={() => { if (n.requestId) navigate(`/requests/${n.requestId}`); removeBubble(n.id); }}
        >
          <div className="bubble-pill">
            <button className="bubble-pill-close" onClick={(e) => { e.stopPropagation(); removeBubble(n.id); }}>✕</button>
            <div className="bubble-pill-icon">
              {getNotificationIcon(n.type || getNotificationType(n.message))}
            </div>
            <div className="bubble-pill-body">
              <div className="bubble-pill-title">{n.requestId ? `Request #${n.requestId}` : 'Notification'}</div>
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
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={t('topbar.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/requests?search=${encodeURIComponent(searchQuery.trim())}`);
                  }
                }}
              />
            </div>
          </div>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleDarkMode} title={darkMode ? t('topbar.switchToLight') : t('topbar.switchToDark')}>
              {darkMode ? <><span className="toggle-icon">☀️</span><span>{t('topbar.bright')}</span></> : <><span className="toggle-icon">🌙</span><span>{t('topbar.dark')}</span></>}
            </button>
            <div className="topbar-icon-container">
              <button className="topbar-icon" title={t('topbar.notifications')} onClick={() => { setShowNotifications(!showNotifications); setShowMessages(false); if (!showNotifications) clearUnreadCount(); }}>
                🔔
                {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="dropdown-panel">
                  <div className="dropdown-panel-header">
                    {t('topbar.notifications')}
                    {unreadCount > 0 && <span style={{ fontSize: '12px', color: '#3B82F6', cursor: 'pointer' }} onClick={clearUnreadCount}>Mark all read</span>}
                  </div>
                  <div className="dropdown-panel-list">
                    {notifications.length === 0 && <div className="dropdown-panel-empty">{t('topbar.noNotifications')}</div>}
                    {notifications.map(n => (
                      <div key={n.id} className={`dropdown-panel-item bubble-type-${getNotificationType(n.message)}`} onClick={() => { if (n.requestId) navigate(`/requests/${n.requestId}`); setShowNotifications(false); }}>
                        <div className="dropdown-panel-icon">
                          {getNotificationIcon(n.type || getNotificationType(n.message))}
                        </div>
                        <div className="dropdown-panel-content">
                          <p>{n.message}</p>
                          <span className="dropdown-panel-time">{n.timestamp ? new Date(n.timestamp).toLocaleString() : n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="topbar-icon-container">
              <button className="topbar-icon" title={t('topbar.messages')} onClick={() => { setShowMessages(!showMessages); setShowNotifications(false); }}>
                ✉️
                {messages.length > 0 && <span className="badge">{messages.length}</span>}
              </button>
              {showMessages && (
                <div className="dropdown-panel">
                  <div className="dropdown-panel-header">{t('topbar.messages')}</div>
                  <div className="dropdown-panel-list">
                    {messages.length === 0 && <div className="dropdown-panel-empty">{t('topbar.noMessages')}</div>}
                    {messages.map((m, i) => (
                      <div key={i} className="dropdown-panel-item" onClick={() => { navigate(`/requests/${m.requestId}`); setShowMessages(false); }}>
                        <div className="dropdown-panel-avatar">{m.user?.name?.charAt(0) || 'U'}</div>
                        <div className="dropdown-panel-content">
                          <p><strong>{m.user?.name || 'Unknown'}</strong> commented on <strong>#{m.requestId}</strong></p>
                          <p className="dropdown-panel-message">{m.content}</p>
                          <span className="dropdown-panel-time">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="user-menu-container">
              <button className="user-menu-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar-tiny">{user?.name?.charAt(0) || 'U'}</div>
                <span>{user?.name}</span>
                <span className="dropdown-arrow">▾</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-avatar">{user?.name?.charAt(0)}</div>
                    <div>
                      <div className="dropdown-name">{user?.name}</div>
                      <div className="dropdown-role">{getRoleLabel(user?.role)}</div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item">👤 {t('topbar.myProfile')}</button>
                  <button className="dropdown-item">⚙️ {t('topbar.settingsLabel')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/login'); }}>
                    🚪 {t('topbar.signOut')}
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
