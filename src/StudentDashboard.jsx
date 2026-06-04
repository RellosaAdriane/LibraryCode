import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { api } from './api';
import { clearAuth, getStoredUser, isAuthenticated } from './auth';
import { loadActivityData } from './pages/student/studentStorage';
import { useLibraryClock } from './hooks/useLibraryClock';
import { useStudentAutoRefresh } from './hooks/useStudentAutoRefresh';
import { formatLibraryTableDate } from './utils/libraryTime';
import { markSessionExpired } from './utils/sessionNotice';
import './StudentDashboard.css';
import { getUserInitials } from './utils/userDisplay';

const formatActivityDate = (dateValue) => formatLibraryTableDate(dateValue);

const getActivityType = (action) => {
  const value = String(action || '').toLowerCase();
  if (value.includes('return')) return 'return';
  if (value.includes('overdue')) return 'overdue';
  return 'borrow';
};

const IconBase = ({ children }) => (
  <svg
    className="nav-icon-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const navIcons = {
  dashboard: (
    <IconBase>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="15" width="7" height="6" rx="1.5" />
    </IconBase>
  ),
  books: (
    <IconBase>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 0 6.5 8H20" />
      <path d="M8 12h8" />
      <path d="M8 15h6" />
    </IconBase>
  ),
  borrowed: (
    <IconBase>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="M9 7h6" />
      <path d="M9 10h5" />
      <path d="m10 16 3 3 3-3" />
      <path d="M13 13v6" />
    </IconBase>
  ),
  returned: (
    <IconBase>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="M9 7h6" />
      <path d="M9 10h5" />
      <path d="m16 16-3 3-3-3" />
      <path d="M13 19v-6" />
    </IconBase>
  ),
  profile: (
    <IconBase>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </IconBase>
  ),
  settings: (
    <IconBase>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 1 1-2.97 2.97l-.04-.04A1.8 1.8 0 0 0 14.8 19.6a1.8 1.8 0 0 0-1.08 1.65V21.4a2.1 2.1 0 1 1-4.2 0v-.06A1.8 1.8 0 0 0 8.4 19.7a1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 1 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 3.8 15.1a1.8 1.8 0 0 0-1.65-1.08H2.1a2.1 2.1 0 1 1 0-4.2h.06A1.8 1.8 0 0 0 3.8 8.7a1.8 1.8 0 0 0-.36-1.98L3.4 6.68A2.1 2.1 0 1 1 6.37 3.7l.04.04A1.8 1.8 0 0 0 8.4 4.1a1.8 1.8 0 0 0 1.08-1.65V2.1a2.1 2.1 0 1 1 4.2 0v.06A1.8 1.8 0 0 0 14.8 3.8a1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 1 1 2.97 2.97l-.04.04A1.8 1.8 0 0 0 19.4 8.4a1.8 1.8 0 0 0 1.65 1.08h.35a2.1 2.1 0 1 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15Z" />
    </IconBase>
  )
};

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user, setUser] = useState(getStoredUser());
  const [activityItems, setActivityItems] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const profileMenuRef = useRef(null);
  const loggedIn = isAuthenticated();
  const storedUser = getStoredUser();
  const hasStaleAuth = Boolean(storedUser && !storedUser?.session_id);
  const firstName = user?.first_name || 'Student';
  const profileInitials = getUserInitials(user);
  const { full: philTime, compact: philTimeShort, title: philTimeTitle, syncNotice } = useLibraryClock();

  const handleSidebarToggle = () => {
    if (!isMobile) return;
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      closeSidebar();
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      if (event.detail) {
        setUser(event.detail);
        return;
      }
      setUser(getStoredUser());
    };

    window.addEventListener('user-updated', handleUserUpdated);
    return () => window.removeEventListener('user-updated', handleUserUpdated);
  }, []);

  const loadSidebarActivity = useCallback(async () => {
    if (!isAuthenticated()) {
      setActivityItems([]);
      return;
    }

    setActivityLoading(true);
    try {
      const items = await loadActivityData();
      setActivityItems(Array.isArray(items) ? items : []);
    } catch {
      setActivityItems([]);
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSidebarActivity();
  }, [loadSidebarActivity, location.pathname]);

  useStudentAutoRefresh({
    loggedIn,
    onSidebarRefresh: loadSidebarActivity
  });

  useEffect(() => {
    const handleActivityRefresh = () => {
      loadSidebarActivity();
    };

    window.addEventListener('user-updated', handleActivityRefresh);
    return () => window.removeEventListener('user-updated', handleActivityRefresh);
  }, [loadSidebarActivity]);

  useEffect(() => {
    const titles = {
      '/student-dashboard': 'Student Dashboard | CVSU Library',
      '/student-dashboard/books': 'Available Books | CVSU Library',
      '/student-dashboard/borrowed': 'Borrowed Books | CVSU Library',
      '/student-dashboard/returned': 'Returned Books | CVSU Library',
      '/student-dashboard/profile': 'My Profile | CVSU Library',
      '/student-dashboard/settings': 'Settings | CVSU Library'
    };
    document.title = titles[location.pathname] || 'CVSU Library';
  }, [location.pathname]);

  useEffect(() => {
    if (!loggedIn) {
      setUser(null);
      return undefined;
    }

    const stored = getStoredUser();
    if (stored) {
      setUser(stored);
    }

    const sessionId = stored?.session_id;
    if (!sessionId || !stored?.id) return undefined;

    let isActive = true;

    const validateSession = async () => {
      if (!isAuthenticated()) return;

      const current = getStoredUser();
      if (!current?.session_id || !current?.id) return;

      const result = await api.validateSession({
        sessionId: current.session_id,
        requesterId: current.id,
        requesterEmail: current.email
      });

      if (!isActive || !isAuthenticated()) return;
      if (!result.success || !result.active) {
        setUser(null);
        setActivityItems([]);
        markSessionExpired();
        clearAuth();
        navigate('/login', { replace: true });
      }
    };

    const touchSession = async () => {
      const current = getStoredUser();
      if (!current?.session_id) return;
      await api.touchSession({ sessionId: current.session_id });
    };

    validateSession();
    const interval = setInterval(touchSession, 60000);
    window.addEventListener('focus', validateSession);

    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener('focus', validateSession);
    };
  }, [loggedIn, navigate]);

  const goToLogin = useCallback(() => {
    setProfileMenuOpen(false);
    setUser(null);
    setActivityItems([]);
    clearAuth();
    navigate('/login', { replace: true });
  }, [navigate]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/books')) return 'Catalog';
    if (path.includes('/borrowed')) return 'Borrowed';
    if (path.includes('/returned')) return 'Returned';
    if (path.includes('/profile')) return 'Profile';
    if (path.includes('/settings')) return 'Settings';
    return 'Home';
  };

  const handleLogout = async () => {
    const sessionUser = getStoredUser();
    setProfileMenuOpen(false);
    setUser(null);
    setActivityItems([]);

    if (sessionUser?.session_id) {
      try {
        await api.revokeSession({
          sessionId: sessionUser.session_id,
          requesterId: sessionUser.id,
          requesterEmail: sessionUser.email
        });
      } catch {
        // Continue with local sign-out if revoke fails.
      }
    }

    clearAuth();
    navigate('/login', { replace: true });
  };

  const handleChangePasswordMenu = () => {
    setProfileMenuOpen(false);
    navigate('/student-dashboard/settings', {
      state: { openChangePassword: true }
    });
  };

  const handleGuestLogin = () => {
    goToLogin();
  };

  const hideGuestBanner =
    !loggedIn
    && (
      location.pathname === '/student-dashboard'
      || location.pathname === '/student-dashboard/'
      || location.pathname === '/student-dashboard/books'
    );

  const menuItems = loggedIn
    ? [
        { icon: navIcons.dashboard, label: 'Home', path: '/student-dashboard' },
        { icon: navIcons.books, label: 'Catalog', path: '/student-dashboard/books' },
        { icon: navIcons.borrowed, label: 'Borrowed', path: '/student-dashboard/borrowed' },
        { icon: navIcons.returned, label: 'Returned', path: '/student-dashboard/returned' },
        { icon: navIcons.profile, label: 'Profile', path: '/student-dashboard/profile' },
        { icon: navIcons.settings, label: 'Settings', path: '/student-dashboard/settings' }
      ]
    : [
        { icon: navIcons.dashboard, label: 'Home', path: '/student-dashboard' },
        { icon: navIcons.books, label: 'Catalog', path: '/student-dashboard/books' }
      ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          {isMobile && (
            <button
              type="button"
              className="hamburger-btn"
              onClick={handleSidebarToggle}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
            >
              {'\u2630'}
            </button>
          )}
          <h1 className="page-title">{getPageTitle()}</h1>
        </div>
        <div className="header-right">
          <div className="philippine-time" title={philTimeTitle} aria-label={philTimeTitle}>
            <span className="sr-only" aria-live="polite">{syncNotice}</span>
            <span className="philippine-time-full" aria-hidden="true">{philTime}</span>
            <span className="philippine-time-compact" aria-hidden="true">{philTimeShort}</span>
            <span className="philippine-time-zone">PHT</span>
          </div>
          {loggedIn ? (
            <div className="header-profile-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="header-profile-trigger"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <span className="header-profile-avatar">{profileInitials}</span>
                <span className="header-user-name">{firstName}</span>
              </button>
              {profileMenuOpen && (
                <div className="header-profile-dropdown" role="menu">
                  <button
                    type="button"
                    className="header-profile-dropdown-item"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/student-dashboard/profile');
                    }}
                  >
                    My Profile
                  </button>
                  <button
                    type="button"
                    className="header-profile-dropdown-item"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/student-dashboard/settings');
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    className="header-profile-dropdown-item"
                    onClick={handleChangePasswordMenu}
                  >
                    Change Password
                  </button>
                  <button
                    type="button"
                    className="header-profile-dropdown-item danger"
                    onClick={handleLogout}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="action-btn header-login-btn"
              onClick={handleGuestLogin}
            >
              {hasStaleAuth ? 'Sign In Again' : 'Sign In'}
            </button>
          )}
        </div>
      </header>

      <div className="dashboard-body">
        <aside
          className={`sidebar ${isMobile ? (sidebarOpen ? 'open' : 'closed') : 'sidebar-desktop'}`}
          aria-hidden={isMobile && !sidebarOpen}
        >
          <div className="sidebar-top">
            <div className="sidebar-brand">
              <div className="sidebar-brand-mark" aria-hidden="true">CV</div>
              <div className="sidebar-brand-text">
                <strong>CVSU Library</strong>
                <small>{loggedIn ? `${firstName}'s portal` : 'Student portal'}</small>
              </div>
            </div>
            {isMobile && (
              <button
                type="button"
                className="sidebar-close-btn"
                onClick={closeSidebar}
                aria-label="Close menu"
              >
                ×
              </button>
            )}
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item, index) => (
              <NavLink
                key={index}
                to={item.path}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={item.path === '/student-dashboard'}
                onClick={() => isMobile && closeSidebar()}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {loggedIn && (
            <section className="sidebar-activity-panel" aria-labelledby="sidebar-activity-title">
              <div className="sidebar-activity-header">
                <h3 id="sidebar-activity-title" className="sidebar-activity-heading">Recent activity</h3>
                <button
                  type="button"
                  className="sidebar-activity-refresh"
                  onClick={loadSidebarActivity}
                  disabled={activityLoading}
                >
                  {activityLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {activityLoading && activityItems.length === 0 ? (
                <ul className="sidebar-activity-feed sidebar-activity-skeleton" aria-hidden="true">
                  {[1, 2, 3].map((slot) => (
                    <li key={slot} className="sidebar-activity-skeleton-row" />
                  ))}
                </ul>
              ) : activityItems.length > 0 ? (
                <ul className="sidebar-activity-feed">
                  {activityItems.slice(0, 12).map((entry) => {
                    const activityType = getActivityType(entry.action);
                    return (
                      <li
                        key={`${entry.id}-${entry.timestamp || entry.date}`}
                        className={`sidebar-activity-card ${activityType}`}
                      >
                        <span className={`activity-dot activity-dot-${activityType}`} aria-hidden="true" />
                        <div className="activity-card-body">
                          <p className="activity-card-headline">
                            <strong>{entry.action}</strong>
                            <span className={`activity-card-status ${String(entry.status || '').toLowerCase()}`}>
                              {entry.status || 'Active'}
                            </span>
                          </p>
                          <p className="activity-card-book" title={entry.book_title}>
                            &ldquo;{entry.book_title}&rdquo;
                          </p>
                          {entry.date && (
                            <time className="activity-card-time" dateTime={entry.date}>
                              {formatActivityDate(entry.date)}
                            </time>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="sidebar-activity-empty">No activity yet. Borrow or return a book to see updates here.</p>
              )}
            </section>
          )}
        </aside>
        {isMobile && sidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            aria-label="Close sidebar"
            onClick={closeSidebar}
          />
        )}

        <main className="main-content">
          {!loggedIn && !hideGuestBanner && (
            <div className="guest-banner" role="status">
              <span>Browsing as guest — sign in to borrow books and manage your account.</span>
              <button type="button" className="guest-banner-btn" onClick={handleGuestLogin}>
                {hasStaleAuth ? 'Sign in again' : 'Sign in'}
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
