import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearAuth, getStoredUser, isAuthenticated } from './auth';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [user, setUser] = useState(getStoredUser());
  const profileMenuRef = useRef(null);
  const loggedIn = isAuthenticated();
  const firstName = user?.first_name || 'Student';
  const firstInitial = firstName.charAt(0).toUpperCase();

  const handleSidebarToggle = () => {
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

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/books')) return 'AVAILABLE BOOKS';
    if (path.includes('/borrowed')) return 'BORROWED BOOKS';
    if (path.includes('/returned')) return 'RETURNED BOOKS';
    if (path.includes('/profile')) return 'MY PROFILE';
    if (path.includes('/settings')) return 'SETTINGS';
    return 'STUDENT DASHBOARD HOME';
  };

  const handleLogout = () => {
    const confirmed = window.confirm('Are you sure you want to logout?');
    if (confirmed) {
      clearAuth();
      navigate('/login', { replace: true });
    }
  };

  const handleChangePasswordMenu = () => {
    setProfileMenuOpen(false);
    navigate('/student-dashboard/settings', {
      state: { openChangePassword: true }
    });
  };

  const handleGuestLogin = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { icon: '\uD83D\uDCCA', label: 'Dashboard', path: '/student-dashboard' },
    { icon: '\uD83D\uDCDA', label: 'Books', path: '/student-dashboard/books' },
    ...(loggedIn
      ? [
          { icon: '\uD83D\uDCD6', label: 'Borrowed', path: '/student-dashboard/borrowed' },
          { icon: '\u2705', label: 'Returned', path: '/student-dashboard/returned' },
          { icon: '\uD83D\uDC64', label: 'Profile', path: '/student-dashboard/profile' },
          { icon: '\u2699\uFE0F', label: 'Settings', path: '/student-dashboard/settings' }
        ]
      : [])
  ];

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <button
            className="hamburger-btn"
            onClick={handleSidebarToggle}
          >
            {'\u2630'}
          </button>
          <h1 className="page-title">{getPageTitle()}</h1>
        </div>
        <div className="header-right">
          {loggedIn ? (
            <div className="header-profile-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="header-profile-trigger"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <span className="header-profile-avatar">{firstInitial}</span>
                <span className="header-user-name">{firstName}</span>
              </button>
              {profileMenuOpen && (
                <div className="header-profile-dropdown" role="menu">
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
              Login
            </button>
          )}
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;
