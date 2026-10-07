import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useTranslation } from '../i18n/useTranslation';
import { api, API_BASE, isTokenExpired } from '../api';
import GlobalSearch from './GlobalSearch';
import LanguageSelector from './LanguageSelector';
import { translateNotification } from '../i18n/translateServer';
import Icon from './Icon';
import { useTrackPrevMenu } from '../utils/sidebarNav';
import { isCriticalUnworked } from '../utils/criticalIndicator';

const CLIENT_MENUS = ['/client', '/client/requests', '/client/activity', '/client/profile'];

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
  useTrackPrevMenu(CLIENT_MENUS);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  // All persisted notification rows for this user (read + unread).
  // Badges and panels derive from real DB is_read state; opening a panel
  // never marks anything read — only clicking an item (or its Read control).
  const [allNotifications, setAllNotifications] = useState([]);
  const [bubbleNotifications, setBubbleNotifications] = useState([]);
  const eventSourceRef = useRef(null);
  const dismissedIds = useRef(new Set());
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
        setShowMessages(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map persisted rows to panel items, preserving DB read state.
  const mapNotifRows = useCallback((rows) => (rows || []).map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    requestId: n.request_id,
    timestamp: n.created_at,
    userName: n.user_name || null,
    is_read: !!n.is_read
  })), []);

  const refreshNotifications = useCallback(() => {
    api.get('/api/notifications').then(data => {
      setAllNotifications(mapNotifRows(data.notifications));
    }).catch(() => {});
  }, [mapNotifRows]);
  // Request lookup for the Critical-dot rule (Priority=Critical AND
  // Status=New|Assigned). Scoped by the same /api/requests RBAC/group
  // visibility — no group logic changed here.
  const [critRequests, setCritRequests] = useState([]);
  const refreshCritRequests = useCallback(() => {
    api.get('/api/requests').then(data => {
      setCritRequests(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  // Mark exactly one item read (persisted). Badge derives from state, so it
  // decreases by exactly 1 per item.
  const markNotificationRead = useCallback((id) => {
    if (!id) return;
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    api.put(`/api/notifications/${id}/read`).catch(() => refreshNotifications());
  }, [refreshNotifications]);

  // Bell panel = non-comment notifications; message panel = comment ones.
  const bellNotes = allNotifications.filter(n => n.type !== 'comment');
  const commentNotes = allNotifications.filter(n => n.type === 'comment');
  const unreadBell = bellNotes.filter(n => !n.is_read).length;
  const unreadMsgs = commentNotes.filter(n => !n.is_read).length;
  // Panel filters: show only read or only unread items per panel.
  const [notifFilter, setNotifFilter] = useState('unread');
  const [msgFilter, setMsgFilter] = useState('unread');
  const shownBell = bellNotes.filter(n => notifFilter === 'read' ? n.is_read : !n.is_read);
  const shownMsgs = commentNotes.filter(n => msgFilter === 'read' ? n.is_read : !n.is_read);
  // Critical-dot helpers: resolve each notification's request to its live
  // Priority + Status. Dots appear ONLY for Critical + (New|Assigned).
  const critReqById = useMemo(() => {
    const m = {};
    for (const r of critRequests) m[String(r.id)] = r;
    return m;
  }, [critRequests]);
  const notifIsCritical = useCallback((n) => {
    if (!n || !n.requestId) return false;
    if (n.is_read) return false;
    return isCriticalUnworked(critReqById[String(n.requestId)]);
  }, [critReqById]);
  const hasCriticalBell = bellNotes.some(notifIsCritical);

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

  // Seed badges + panels from persisted DB read state (survives reloads).
  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    refreshCritRequests();
    const h = () => { refreshNotifications(); refreshCritRequests(); };
    window.addEventListener('refresh-requests', h);
    return () => window.removeEventListener('refresh-requests', h);
  }, [user, refreshNotifications, refreshCritRequests]);

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

          const isOwnAction = notification.userId && String(notification.userId) === String(user.id);

          // Rows are already persisted server-side per user: refetch real
          // rows (with DB ids) so badges stay exact and read state is kept.
          if (!isOwnAction) {
            refreshNotifications();
            refreshCritRequests();
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

  // Load messages panel from persisted comment notifications (per-item
  // read state). Polling refetches real DB rows — never auto-marks read.
  useEffect(() => {
    if (!user) return;
    refreshNotifications();
    const timer = setInterval(refreshNotifications, 15000);
    return () => clearInterval(timer);
  }, [user, refreshNotifications]);

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

  const handleRefreshSystem = () => {
    setShowUserMenu(false);
    setRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 700);
  };

  // Opening a panel never marks anything read — only item clicks do.
  const openNotifications = () => {    const next = !showNotifications;
    setShowNotifications(next);
    if (next) {
      setShowMessages(false);
    }
  };

  const openMessages = () => {
    const next = !showMessages;
    setShowMessages(next);
    setShowNotifications(false);
  };

  // Explicit "mark all read" control (user-initiated, persisted).
  const markAllRead = useCallback(() => {
    setAllNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    api.put('/api/notifications/read-all').catch(() => refreshNotifications());
  }, [refreshNotifications]);

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
  ];

  const activeMenuItem = menuItems.find((item) => location.pathname === item.path)
    || menuItems.find((item) => item.path !== '/client' && location.pathname.startsWith(item.path + '/'));

  return (
    <div className={`layout role-${user?.role || 'guest'}`}>
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

      {refreshing && (
        <div className="refresh-overlay">
          <div className="refresh-overlay-card">
            <div className="spinner"></div>
            <p>{t('common.refreshingSystem')}</p>
          </div>
        </div>
      )}

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="menu" /></button>
            {activeMenuItem && <span className="topbar-page-title">{activeMenuItem.label}</span>}
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
                {unreadBell > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {unreadBell > 99 ? '99+' : unreadBell}
                  </span>
                )}
                {hasCriticalBell && <span className="critical-dot" style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid #fff' }} title="Critical request needs work" />}
              </button>
              {showNotifications && (
                <div className="dropdown-panel notification-panel" style={{ width: 420, border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb', background: darkMode ? '#1e293b' : '#fff' }}>
                  <div className="dropdown-panel-header" style={{ color: darkMode ? '#e2e8f0' : 'inherit' }}>
                    <span>{t('common.notifications')}</span>
                    {bellNotes.some(n => !n.is_read) && <span style={{ fontSize: '12px', color: '#3B82F6', cursor: 'pointer' }} onClick={markAllRead}>{t('common.markAllRead')}</span>}
                  </div>
                  <div className="notif-filter-tabs">
                    <button className={`notif-filter-btn left${notifFilter === 'unread' ? ' active' : ''}`} onClick={() => setNotifFilter('unread')}>{t('common.unread')} ({unreadBell})</button>
                    <button className={`notif-filter-btn right${notifFilter === 'read' ? ' active' : ''}`} onClick={() => setNotifFilter('read')}>{t('common.read')} ({bellNotes.filter(n => n.is_read).length})</button>
                  </div>
                  {shownBell.length === 0 ? (
                    <div className="dropdown-panel-empty">{t('common.noNotifications')}</div>
                  ) : (
                    <div className="dropdown-panel-list">
                      {shownBell.map((n) => (
                        <div key={n.id} className={`dropdown-panel-item${n.is_read ? '' : ' notif-unread'}`} onClick={() => { markNotificationRead(n.id); setShowNotifications(false); if (n.requestId) navigate(`/client/requests/${n.requestId}`); }}>
                          <div className="dropdown-panel-icon"><Icon name={getNotificationIcon(n.type)} size={16} /></div>
                          <div className="dropdown-panel-content">
                            <div className="dropdown-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {notifIsCritical(n) && <span className="critical-dot" title="Critical request needs work" />}
                              {getNotifTitle(n.type)}
                              {n.requestId && <span className="dropdown-panel-request">{t('common.requestPrefixLabel')}-{String(n.requestId).padStart(4, '0')}</span>}
                            </div>
                            <p className="dropdown-panel-message">{translateNotification(n.message, n, t)}</p>
                            <div className="dropdown-panel-meta">
                              {n.userName && <span className="dropdown-panel-user"><Icon name="user" size={12} /> {n.userName}</span>}
                              <span className="dropdown-panel-time">{n.timestamp ? new Date(n.timestamp).toLocaleString() : ''}</span>
                            </div>
                          </div>
                          <div className="dropdown-panel-read">
                            {!n.is_read && <span className="notif-unread-dot" title={t('common.unread')} />}
                            {!n.is_read ? (
                              <button className="notif-read-btn" onClick={(e) => { e.stopPropagation(); markNotificationRead(n.id); }}>{t('common.markRead')}</button>
                            ) : (
                              <span className="notif-read-state">{t('common.read')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="notification-container" style={{ position: 'relative' }}>
              <button className="theme-toggle" onClick={openMessages} title={t('topbar.messages')} style={{ position: 'relative' }}>
                <span className="toggle-icon"><Icon name="mail" /></span>
                {unreadMsgs > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {unreadMsgs > 99 ? '99+' : unreadMsgs}
                  </span>
                )}
              </button>
              {showMessages && (
                <div className="dropdown-panel notification-panel" style={{ width: 420, border: darkMode ? '1px solid #334155' : '1px solid #e5e7eb', background: darkMode ? '#1e293b' : '#fff' }}>
                  <div className="dropdown-panel-header" style={{ color: darkMode ? '#e2e8f0' : 'inherit' }}>
                    <span>{t('topbar.messages')}</span>
                    {commentNotes.some(n => !n.is_read) && <span style={{ fontSize: '12px', color: '#3B82F6', cursor: 'pointer' }} onClick={markAllRead}>{t('common.markAllRead')}</span>}
                  </div>
                  <div className="notif-filter-tabs">
                    <button className={`notif-filter-btn left${msgFilter === 'unread' ? ' active' : ''}`} onClick={() => setMsgFilter('unread')}>{t('common.unread')} ({unreadMsgs})</button>
                    <button className={`notif-filter-btn right${msgFilter === 'read' ? ' active' : ''}`} onClick={() => setMsgFilter('read')}>{t('common.read')} ({commentNotes.filter(n => n.is_read).length})</button>
                  </div>
                  {shownMsgs.length === 0 ? (
                    <div className="dropdown-panel-empty">{t('topbar.noMessages')}</div>
                  ) : (
                    <div className="dropdown-panel-list">
                      {shownMsgs.slice(0, 10).map((m) => (
                        <div key={m.id} className={`dropdown-panel-item${m.is_read ? '' : ' notif-unread'}`} onClick={() => { markNotificationRead(m.id); navigate(`/client/requests/${m.requestId}`); setShowMessages(false); }}>
                          <div className="dropdown-panel-icon"><Icon name="comment" size={16} /></div>
                          <div className="dropdown-panel-content">
                            <p><strong>{m.userName || t('common.unknown')}</strong> {t('common.commentedOn')} <strong>#{m.requestId}</strong></p>
                            <p className="dropdown-panel-message">{translateNotification(m.message, m, t)}</p>
                            <span className="dropdown-panel-time">{m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}</span>
                          </div>
                          <div className="dropdown-panel-read">
                            {!m.is_read && <span className="notif-unread-dot" title={t('common.unread')} />}
                            {!m.is_read ? (
                              <button className="notif-read-btn" onClick={(e) => { e.stopPropagation(); markNotificationRead(m.id); }}>{t('common.markRead')}</button>
                            ) : (
                              <span className="notif-read-state">{t('common.read')}</span>
                            )}
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <div className="user-avatar-tiny" style={{ background: '#7c3aed', overflow: 'hidden' }}>{getAvatarUrl(user?.avatar) ? <img src={getAvatarUrl(user?.avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.name?.charAt(0) || 'U')}</div>
                  {user?.approved === false && (
                    <div title={t('common.blocked')} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', color: '#fff' }}>
                      <Icon name="lock" size={10} />
                    </div>
                  )}
                </div>
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
                  <button className="dropdown-item" onClick={handleRefreshSystem} title={t('common.refreshTitle')}><span className="dropdown-item-icon"><Icon name="refresh" /></span> {t('common.refresh')}</button>
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
