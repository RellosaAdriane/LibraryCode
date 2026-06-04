import { useCallback, useEffect, useMemo } from 'react';
import { emptyForm, SETTINGS_TABS } from '../constants';
import { getTimeGreeting } from '../utils/borrowHelpers';
import { subscribeLibraryDataChanged } from '../../utils/libraryDataEvents';
import { useAdminActivity } from './useAdminActivity';
import { useAdminBooks } from './useAdminBooks';
import { useAdminCirculation } from './useAdminCirculation';
import { useAdminSessions } from './useAdminSessions';
import { useAdminSettings } from './useAdminSettings';
import { useAdminShell } from './useAdminShell';
import { useAdminAutoRefresh } from './useAdminAutoRefresh';
import { useAdminUsers } from './useAdminUsers';

export function useAdminDashboard() {
  const shell = useAdminShell();
  const {
    user,
    navigate,
    message,
    setMessage,
    confirmDialog,
    setConfirmDialog,
    userToast,
    showUserToast,
    activeSection,
    setActiveSection
  } = shell;

  const activity = useAdminActivity({ user, setMessage, setConfirmDialog, showUserToast });
  const { logAction, loadStudentActivity, loadSecurityLogs, securityLogs } = activity;

  const books = useAdminBooks({ user, setMessage, logAction, setActiveSection });
  const { loadBooks, summary, lowStockBooks } = books;

  const circulation = useAdminCirculation({ user });
  const { loadBorrowRecords, loadRecentActivity, circulationToday, borrowRecordCounts } = circulation;

  const users = useAdminUsers({
    user,
    setMessage,
    setConfirmDialog,
    logAction,
    showUserToast,
    securityLogs
  });
  const { loadUsers } = users;

  const sessions = useAdminSessions({
    user,
    setMessage,
    setConfirmDialog,
    logAction,
    showUserToast
  });
  const { loadSessions } = sessions;

  const settings = useAdminSettings({
    user,
    setMessage,
    setConfirmDialog,
    logAction,
    showUserToast,
    sessions: sessions.sessions,
    securityLogs,
    lowStockBooks
  });

  const dashboardInsights = useMemo(() => {
    const displayName = user.first_name || 'Admin';
    const lines = [];
    if (circulationToday.returnedToday > 0) {
      lines.push(`You processed ${circulationToday.returnedToday} return${circulationToday.returnedToday === 1 ? '' : 's'} today.`);
    }
    if (summary.lowStock > 0) {
      lines.push(`${summary.lowStock} title${summary.lowStock === 1 ? '' : 's'} need${summary.lowStock === 1 ? 's' : ''} restocking.`);
    }
    if (circulationToday.overdueCount === 0 && borrowRecordCounts.active > 0) {
      lines.push('All active loans are on schedule.');
    } else if (circulationToday.overdueCount > 0) {
      lines.push(`${circulationToday.overdueCount} loan${circulationToday.overdueCount === 1 ? '' : 's'} need follow-up.`);
    }
    if (lines.length === 0) {
      lines.push('Circulation is quiet — inventory and loans look healthy.');
    }
    return { greeting: getTimeGreeting(), displayName, lines };
  }, [user.first_name, circulationToday, summary.lowStock, borrowRecordCounts.active]);

  const isCirculationView = activeSection === 'home' || activeSection === 'circulation';

  const refreshCirculationData = useCallback(({ silent = false } = {}) => {
    loadBorrowRecords({ silent });
    loadRecentActivity({ silent });
  }, [loadBorrowRecords, loadRecentActivity]);

  const handleHeaderRefresh = useCallback(() => {
    loadBooks();
    loadBorrowRecords();
    loadRecentActivity();

    if (activeSection === 'users') {
      loadUsers();
    }
    if (activeSection === 'settings') {
      loadSessions();
      settings.loadSignupSettings();
      settings.loadPenaltySettings();
      settings.loadAnnouncementSettings();
      settings.loadSsoSettings();
      settings.loadAdmin2faSettings();
    }
    if (activeSection === 'student-logs') {
      loadStudentActivity();
    }
    if (activeSection === 'activity') {
      loadSecurityLogs();
    }
  }, [
    activeSection,
    loadBooks,
    loadBorrowRecords,
    loadRecentActivity,
    loadUsers,
    loadSessions,
    loadStudentActivity,
    loadSecurityLogs,
    settings.loadSignupSettings,
    settings.loadPenaltySettings,
    settings.loadAnnouncementSettings,
    settings.loadSsoSettings,
    settings.loadAdmin2faSettings
  ]);

  const handleAutoRefresh = useCallback(() => {
    if (isCirculationView) {
      refreshCirculationData({ silent: true });
      return;
    }

    handleHeaderRefresh();
  }, [handleHeaderRefresh, isCirculationView, refreshCirculationData]);

  useAdminAutoRefresh({
    user,
    onDataChanged: handleAutoRefresh,
    pollMs: isCirculationView ? 2000 : 5000
  });

  useEffect(() => subscribeLibraryDataChanged(() => {
    if (isCirculationView) {
      refreshCirculationData({ silent: true });
    }
  }), [isCirculationView, refreshCirculationData]);

  useEffect(() => {
    loadBooks();
    loadBorrowRecords();
    loadRecentActivity();
    loadStudentActivity();
    settings.loadSignupSettings();
    settings.loadPenaltySettings();
    settings.loadAnnouncementSettings();
    loadSecurityLogs();
    settings.loadSsoSettings();
    settings.loadAdmin2faSettings();
  }, [
    settings.loadSignupSettings,
    settings.loadPenaltySettings,
    settings.loadAnnouncementSettings,
    loadStudentActivity,
    loadSecurityLogs,
    settings.loadSsoSettings,
    settings.loadAdmin2faSettings,
    loadBorrowRecords,
    loadRecentActivity
  ]);

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers();
    }
  }, [activeSection, loadUsers]);

  useEffect(() => {
    if (activeSection === 'home' || activeSection === 'circulation') {
      loadBorrowRecords();
      loadRecentActivity();
    }
  }, [activeSection, loadBorrowRecords, loadRecentActivity]);

  useEffect(() => {
    if (activeSection === 'settings') {
      loadSessions();
    }
  }, [activeSection, loadSessions]);

  return {
    ...shell,
    ...activity,
    ...books,
    ...circulation,
    ...users,
    ...settings,
    ...sessions,
    message,
    dashboardInsights,
    handleHeaderRefresh,
    emptyForm,
    SETTINGS_TABS
  };
}
