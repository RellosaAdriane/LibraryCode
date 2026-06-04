import React from 'react';
import AdminNavIcon from './AdminNavIcon';

const AdminLayout = ({ admin, children }) => {
  const {
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    user,
    getPageTitle,
    philTime,
    philTimeShort,
    philTimeTitle,
    syncNotice,
    handleHeaderRefresh,
    handleLogout,
    menuItems,
    message
  } = admin;

  return (
    <div className="admin-dashboard-container">
      <header className="admin-dashboard-header">
        <div className="header-left">
          <button className="hamburger-btn" type="button" onClick={() => setSidebarOpen((prev) => !prev)}>☰</button>
          <div className="header-title-block">
            <h1 className="page-title">{getPageTitle()}</h1>
            {activeSection === 'circulation' && (
              <p className="page-subtitle">Monitor loans, returns, and inventory alerts in real time</p>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="philippine-time" title={philTimeTitle} aria-label={philTimeTitle}>
            <span className="sr-only" aria-live="polite">{syncNotice}</span>
            <span className="philippine-time-full" aria-hidden="true">{philTime}</span>
            <span className="philippine-time-compact" aria-hidden="true">{philTimeShort}</span>
            <span className="philippine-time-zone">PHT</span>
          </div>
          <button
            type="button"
            className="action-btn header-refresh-btn"
            onClick={handleHeaderRefresh}
            aria-label="Refresh dashboard data"
          >
            <AdminNavIcon name="refresh" />
            <span className="header-refresh-label" aria-hidden="true">Refresh</span>
          </button>
          <button type="button" className="action-btn header-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="admin-sidebar-profile">
            <div className="admin-sidebar-avatar" aria-hidden="true">CV</div>
            <div className="admin-sidebar-identity">
              <div className="admin-sidebar-title-row">
                <span className="admin-sidebar-title">Library Admin</span>
                <span className="admin-sidebar-role">{user.role || 'admin'}</span>
              </div>
              <span className="admin-sidebar-name">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Admin user'}
              </span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${item.parentId ? 'nav-item-sub' : ''} ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="nav-icon"><AdminNavIcon name={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        {isMobile && sidebarOpen && (
          <button type="button" className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />
        )}

        <main className="main-content">
          <div className="content-wrapper">
            {message && <div className="dashboard-message">{message}</div>}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
