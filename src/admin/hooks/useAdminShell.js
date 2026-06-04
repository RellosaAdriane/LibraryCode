import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { clearAuth, getStoredUser } from '../../auth';
import { useLibraryClock } from '../../hooks/useLibraryClock';
import { markSessionExpired } from '../../utils/sessionNotice';

export function useAdminShell() {
  const navigate = useNavigate();
  const user = getStoredUser() || {};
  const [message, setMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [userToast, setUserToast] = useState('');
  const [activeSection, setActiveSection] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { full: philTime, compact: philTimeShort, title: philTimeTitle, syncNotice } = useLibraryClock();

  const menuItems = [
    { id: 'home', icon: 'dashboard', label: 'Dashboard' },
    { id: 'books', icon: 'books', label: 'Manage Books' },
    { id: 'circulation', icon: 'loan', label: 'Borrow / Return', parentId: 'books' },
    { id: 'analytics', icon: 'analytics', label: 'Analytics' },
    { id: 'activity', icon: 'activity', label: 'Admin Activity' },
    { id: 'student-logs', icon: 'logs', label: 'Student Logs' },
    { id: 'users', icon: 'users', label: 'Manage Users' },
    { id: 'settings', icon: 'settings', label: 'Settings' }
  ];

  const getPageTitle = () => {
    if (isMobile) {
      if (activeSection === 'books') return 'Books';
      if (activeSection === 'circulation') return 'Circulation';
      if (activeSection === 'analytics') return 'Analytics';
      if (activeSection === 'activity') return 'Activity';
      if (activeSection === 'student-logs') return 'Student logs';
      if (activeSection === 'users') return 'Users';
      if (activeSection === 'settings') return 'Settings';
      return 'Home';
    }
    if (activeSection === 'books') return 'Book Management';
    if (activeSection === 'circulation') return 'Borrow & Return';
    if (activeSection === 'analytics') return 'Library Analytics';
    if (activeSection === 'activity') return 'Admin Activity Log';
    if (activeSection === 'student-logs') return 'Student Activity Logs';
    if (activeSection === 'users') return 'User Management';
    if (activeSection === 'settings') return 'Admin Settings';
    return 'Admin Dashboard Home';
  };

  const showUserToast = (text, isError = false) => {
    if (!text) return;
    setUserToast(isError ? `❌ ${text}` : `✅ ${text}`);
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    setMessage('');
  }, [activeSection]);

  useEffect(() => {
    if (!userToast) return undefined;
    const timeoutId = window.setTimeout(() => setUserToast(''), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [userToast]);

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
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [activeSection, isMobile]);

  useEffect(() => {
    const sessionId = user?.session_id;
    if (!sessionId || !user?.id) return undefined;
    let isActive = true;

    const validateSession = async () => {
      const result = await api.validateSession({
        sessionId,
        requesterId: user.id,
        requesterEmail: user.email
      });

      if (!isActive) return;
      if (!result.success || !result.active) {
        markSessionExpired();
        clearAuth();
        navigate('/login', { replace: true });
      }
    };

    const touchSession = async () => {
      await api.touchSession({ sessionId });
    };

    validateSession();
    const interval = setInterval(touchSession, 60000);
    window.addEventListener('focus', validateSession);

    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener('focus', validateSession);
    };
  }, [user?.id, user?.email, user?.session_id, navigate]);

  return {
    user,
    navigate,
    message,
    setMessage,
    confirmDialog,
    setConfirmDialog,
    userToast,
    showUserToast,
    activeSection,
    setActiveSection,
    sidebarOpen,
    setSidebarOpen,
    isMobile,
    setIsMobile,
    philTime,
    philTimeShort,
    philTimeTitle,
    syncNotice,
    menuItems,
    getPageTitle,
    handleLogout
  };
}
