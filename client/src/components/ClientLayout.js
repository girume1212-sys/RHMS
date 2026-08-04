import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { API_BASE, isTokenExpired } from '../api';
import GlobalSearch from './GlobalSearch';
import LanguageSelector from './LanguageSelector';
import { translateNotification } from '../i18n/translateServer';
import Icon from './Icon';

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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [panelNotifications, setPanelNotifications] = useState([]);
  const [bubbleNotifications, setBubbleNotifications] = useState([]);
  const eventSourceRef = useRef(null);
  const dismissedIds = useRef(new Set());
  const showNotificationsRef = useRef(false);
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

  useEffect(() => {
    showNotificationsRef.current = showNotifications;
  }, [showNotifications]);

  const getNotificationIcon = useCallback((type) => {
    const icons = { status_change: 'refresh', assigned: 'user', comment: 'comment', request_created: 'requests', request_deleted: 'delete', default: 'bell' };
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

    if (isTokenExpired(token)) {
      localStorage.removeItem('rhms_token');
      localStorage.removeItem('rhms_sessionTimeout');
      window.location.href = '/login?expired=1';
      return;
    }

    let reconnectTimeout = null;
    let failedAttempts = 0;

    function connectSSE() {
      const eventSource = new EventSource(`${API_BASE}/api/notifications/stream?token=${token}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => { failedAttempts = 0; };

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
            userId: data.data?.userId,
            userName: data.data?.userName,
            subject: data.data?.subject,
            status: data.data?.status,
            assignee: data.data?.assignee,
            timestamp: data.timestamp
          };

          setUnreadNotifications(prev => [notification, ...prev].slice(0, 20));
          if (showNotificationsRef.current) {
            setPanelNotifications(prev => [notification, ...prev].slice(0, 20));
          }

          if (!dismissedIds.current.has(notification.id) && notification.userId !== user.id) {
            setBubbleNotifications(prev => [notification, ...prev].slice(0, 5));
            setTimeout(() => removeBubble(notification.id), 2000);
          }

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
        if (isTokenExpired(token)) {
          localStorage.removeItem('rhms_token');
          localStorage.removeItem('rhms_sessionTimeout');
          window.location.href = '/login?expired=1';
          return;
        }
        failedAttempts += 1;
        const delay = Math.min(3000 * Math.pow(2, failedAttempts - 1), 30000);
        reconnectTimeout = setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            connectSSE();
          }
        }, delay);
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

  const openNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      setPanelNotifications(unreadNotifications);
      setUnreadNotifications([]);
    }
  };

  const markAllRead = useCallback(() => {
    setUnreadNotifications([]);
    setPanelNotifications([]);
  }, []);

  const getNotifTitle = (type) => {
    const titles = {
      request_created: t('common.newRequest'),
      status_change: t('common.statusChange'),
      assigned: t('common.assignment'),
      claimed: t('common.requestClaimed'),
      comment: t('common.newComment'),
      request_deleted: t('common.requestDeletedTitle'),
      default: t('common.notification')
    };
    return titles[type] || titles.default;
  };

  const menuItems = [
    { path: '/client', label: t('common.dashboard'), icon: 'home' },
    { path: '/client/requests', label: t('common.myRequests'), icon: 'requests' },
    { path: '/client/activity', label: t('common.activityLog'), icon: 'activity' },
    { path: '/client/profile', label: t('common.myProfile'), icon: 'user' },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            {systemLogo ? (
              <img src={`${API_BASE}${systemLogo}`} alt="Logo" className="sidebar-logo" />
            ) : (
              <svg className="sidebar-logo" viewBox="0 0 48 48" fill="none" preserveAspectRatio="xMidYMid meet">
                <circle cx="24" cy="24" r="24" fill="#7c3aed"/>
                <path d="M16 18C16 15.79 17.79 14 20 14H28C30.21 14 32 15.79 32 18V22C32 24.21 30.21 26 28 26H20C17.79 26 16 24.21 16 22V18Z" fill="white"/>
                <circle cx="24" cy="32" r="4" fill="white"/>
                <path d="M20 36H28" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
            {sidebarOpen && (
              <div>
                <h2 className="brand-title">
                  {t('general.appName')}
                  <span className="support-system-sub">{t('general.supportSystem')}</span>
                </h2>
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
              <span className="nav-icon"><Icon name={item.icon} /></span>
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
              <Icon name={getNotificationIcon(n.type)} size={16} />
            </div>
              <div className="bubble-pill-body">
              <div className="bubble-pill-title">{n.requestId ? `${t('common.requestShort')} #${n.requestId}` : t('common.notifications')}</div>
              <div className="bubble-pill-text">{translateNotification(n.message, n, t)}</div>
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
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="menu" /></button>
            <GlobalSearch clientMode placeholder={t('common.searchRequests')} />
          </div>
          <div className="topbar-right">
            <LanguageSelector variant="topbar" />
            <button className="theme-toggle" onClick={toggleDarkMode} title={darkMode ? t('topbar.switchToLight') : t('topbar.switchToDark')}>
              {darkMode ? <><span className="toggle-icon"><Icon name="sun" /></span><span className="theme-toggle-label">{t('common.brightMode')}</span></> : <><span className="toggle-icon"><Icon name="moon" /></span><span className="theme-toggle-label">{t('common.darkMode')}</span></>}
            </button>
            <div className="notification-container" style={{ position: 'relative' }}>
              <button className="theme-toggle" onClick={openNotifications} title={t('common.notifications')} style={{ position: 'relative' }}>
                <span className="toggle-icon"><Icon name="bell" /></span>
                {unreadNotifications.length > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="dropdown-panel notification-panel" style={{ width: 420, border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb', background: darkMode ? '#1e293b' : '#fff' }}>
                  <div className="dropdown-panel-header" style={{ color: darkMode ? '#e2e8f0' : 'inherit' }}>
                    <span>{t('common.notifications')}</span>
                    {panelNotifications.length > 0 && <span style={{ fontSize: '12px', color: '#3B82F6', cursor: 'pointer' }} onClick={markAllRead}>{t('common.markAllRead')}</span>}
                  </div>
                  {panelNotifications.length === 0 ? (
                    <div className="dropdown-panel-empty">{t('common.noNotifications')}</div>
                  ) : (
                    <div className="dropdown-panel-list">
                      {panelNotifications.map((n) => (
                        <div key={n.id} className="dropdown-panel-item" onClick={() => { setShowNotifications(false); if (n.requestId) navigate(`/client/requests/${n.requestId}`); }}>
                          <div className="dropdown-panel-icon"><Icon name={getNotificationIcon(n.type)} size={16} /></div>
                          <div className="dropdown-panel-content">
                            <div className="dropdown-panel-title">
                              {getNotifTitle(n.type)}
                              {n.requestId && <span className="dropdown-panel-request">{t('common.requestPrefixLabel')}-{String(n.requestId).padStart(4, '0')}</span>}
                            </div>
                            <p className="dropdown-panel-message">{translateNotification(n.message, n, t)}</p>
                            <div className="dropdown-panel-meta">
                              {n.userName && <span className="dropdown-panel-user"><Icon name="user" size={12} /> {n.userName}</span>}
                              <span className="dropdown-panel-time">{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
                  <button className="dropdown-item" onClick={() => { setShowUserMenu(false); navigate('/client/profile'); }}><span className="dropdown-item-icon"><Icon name="user" /></span> {t('common.myProfile')}</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/login'); }}>
                    <span className="dropdown-item-icon"><Icon name="logout" /></span> {t('common.signOut')}
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
