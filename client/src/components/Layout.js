import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const menuItems = [
    { section: null, items: [
      { path: '/', label: 'Dashboard', icon: '🏠' },
    ]},
    { section: null, items: [
      { path: '/requests', label: 'Requests', icon: '📄', children: [
        { path: '/requests/create', label: 'Create Request' },
        { path: '/requests?filter=my', label: 'My Requests' },
      ]},
    ]},
    { section: 'MANAGEMENT', items: [
      { path: '/users', label: 'Users', icon: '👥', roles: ['admin', 'support'] },
      { path: '/categories', label: 'Categories', icon: '📁', roles: ['admin'] },
      { path: '/priorities', label: 'Priorities', icon: '⚠️', roles: ['admin'] },
      { path: '/roles', label: 'Roles & Permissions', icon: '🔐', roles: ['admin'] },
    ]},
    { section: 'REPORTS', items: [
      { path: '/reports', label: 'Reports & Analytics', icon: '📊', roles: ['admin', 'support'] },
      { path: '/activity', label: 'Activity Log', icon: '📝' },
    ]},
    { section: 'SETTINGS', items: [
      { path: '/settings', label: 'System Settings', icon: '⚙️', roles: ['admin'] },
    ]},
  ];

  const hasPermission = (item) => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  };

  const getRoleLabel = (role) => {
    const labels = { admin: 'Administrator', support: 'Support Team', developer: 'Developer', client: 'Client' };
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
                <h2>RHMS</h2>
                <span>Support System</span>
              </div>
            )}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
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
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search requests, users, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="topbar-right">
            <button className="topbar-icon" title="Notifications">
              🔔
              <span className="badge">5</span>
            </button>
            <button className="topbar-icon" title="Messages">
              ✉️
              <span className="badge">3</span>
            </button>
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
                  <button className="dropdown-item">👤 My Profile</button>
                  <button className="dropdown-item">⚙️ Settings</button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout" onClick={() => { logout(); navigate('/login'); }}>
                    🚪 Sign Out
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
