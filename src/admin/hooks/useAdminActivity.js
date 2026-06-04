import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { formatLibraryNowStamp } from '../../utils/libraryTime';

export function useAdminActivity({ user, setMessage, setConfirmDialog, showUserToast }) {
  const [activityLog, setActivityLog] = useState([]);
  const [studentActivityLog, setStudentActivityLog] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(true);

  const getAdminDisplayName = useCallback(() => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.email || 'Admin';
  }, [user.email, user.first_name, user.last_name]);

  const logAction = (action, details) => {
    const now = Date.now();
    setActivityLog((prev) => [
      {
        id: now,
        adminName: getAdminDisplayName(),
        action,
        details,
        time: formatLibraryNowStamp(),
        timestamp: now
      },
      ...prev
    ]);
  };

  const loadStudentActivity = useCallback(() => {
    const prefix = 'library.student.';
    const suffix = '.activity';
    const collected = [];

    (async () => {
      try {
        const result = await api.getStudentActivities();
        if (result.success && Array.isArray(result.activities)) {
          result.activities.forEach((entry, idx) => {
            const ts = Number(entry.timestamp) || Date.parse(entry.time || '') || 0;
            collected.push({
              id: `student-server-${idx}-${ts}`,
              source: 'Student',
              user: entry.email || 'student',
              action: entry.action || 'Activity',
              details: entry.details || '-',
              time: entry.time || '-',
              timestamp: ts
            });
          });
        }
      } catch (err) {
        // ignore server activity errors and fall back to localStorage
      }

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;

        const studentEmail = key.slice(prefix.length, -suffix.length) || 'student';

        try {
          const raw = localStorage.getItem(key);
          const entries = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(entries)) continue;

          entries.forEach((entry, entryIndex) => {
            const timestamp = Number(entry?.timestamp) || Date.parse(entry?.date || '') || 0;
            collected.push({
              id: `student-${studentEmail}-${entry?.id || timestamp || entryIndex}`,
              source: 'Student',
              user: studentEmail,
              action: entry?.action || 'Activity',
              details: entry?.book_title || entry?.details || '-',
              time: entry?.time || entry?.date || '-',
              timestamp
            });
          });
        } catch (error) {
          // Ignore malformed student activity payloads.
        }
      }

      collected.sort((a, b) => b.timestamp - a.timestamp);
      setStudentActivityLog(collected);
    })();
  }, []);

  const loadSecurityLogs = useCallback(async () => {
    setSecurityLogsLoading(true);
    const result = await api.getSecurityLogs();
    if (result.success) {
      setSecurityLogs(Array.isArray(result.logs) ? result.logs : []);
    } else {
      setMessage(result.message || 'Failed to load security logs.');
    }
    setSecurityLogsLoading(false);
  }, [setMessage]);

  const handleClearActivityLog = () => {
    setConfirmDialog({
      title: 'Clear activity log?',
      message: 'All admin activity records on this device will be removed. This cannot be undone.',
      confirmLabel: 'Clear logs',
      onConfirm: () => {
        setConfirmDialog(null);
        setActivityLog([]);
        showUserToast('Activity log cleared.');
      }
    });
  };

  useEffect(() => {
    const syncStudentActivity = () => loadStudentActivity();
    window.addEventListener('storage', syncStudentActivity);
    window.addEventListener('focus', syncStudentActivity);
    return () => {
      window.removeEventListener('storage', syncStudentActivity);
      window.removeEventListener('focus', syncStudentActivity);
    };
  }, [loadStudentActivity]);

  return {
    activityLog,
    setActivityLog,
    logAction,
    loadStudentActivity,
    studentActivityLog,
    securityLogs,
    securityLogsLoading,
    loadSecurityLogs,
    handleClearActivityLog
  };
}
