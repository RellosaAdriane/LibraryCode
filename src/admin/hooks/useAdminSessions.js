import { useCallback, useMemo, useState } from 'react';
import { api } from '../../api';
import { formatLibraryTableDateTime } from '../../utils/libraryTime';
import { parseSessionAgent } from '../utils/sessionUtils';

export function useAdminSessions({ user, setMessage, setConfirmDialog, logAction, showUserToast }) {
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('active');

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsRefreshing(true);
    const result = await api.getSessions({ requesterId: user.id, requesterEmail: user.email, includeRevoked: true });
    if (result.success) {
      setSessions(Array.isArray(result.sessions) ? result.sessions : []);
    } else {
      setMessage(result.message || 'Failed to load sessions.');
    }
    setSessionsRefreshing(false);
    setSessionsLoading(false);
  }, [user.id, user.email, setMessage]);

  const formatSessionTime = (value) => formatLibraryTableDateTime(value);

  const handleRevokeSession = (sessionId, sessionEmail = '') => {
    if (!sessionId) return;

    setConfirmDialog({
      title: 'Revoke session?',
      message: `This will sign out ${sessionEmail || 'this user'} from that device immediately. This action cannot be undone.`,
      confirmLabel: 'Revoke session',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await api.revokeSession({
          sessionId,
          requesterId: user.id,
          requesterEmail: user.email
        });

        if (result.success) {
          showUserToast('Session revoked successfully.');
          loadSessions();
          logAction('Session Revoked', sessionId);
        } else {
          showUserToast(result.message || 'Failed to revoke session.', true);
        }
      }
    });
  };

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return sessions.filter((session) => {
      const isRevoked = Boolean(session.revoked_at);
      if (sessionStatusFilter === 'active' && isRevoked) return false;
      if (sessionStatusFilter === 'revoked' && !isRevoked) return false;
      if (!query) return true;
      const device = parseSessionAgent(session.user_agent);
      return (
        String(session.email || '').toLowerCase().includes(query)
        || String(session.ip || '').includes(query)
        || device.browser.toLowerCase().includes(query)
        || device.os.toLowerCase().includes(query)
      );
    });
  }, [sessions, sessionSearch, sessionStatusFilter]);

  return {
    sessions,
    sessionsLoading,
    sessionsRefreshing,
    loadSessions,
    sessionSearch,
    setSessionSearch,
    sessionStatusFilter,
    setSessionStatusFilter,
    filteredSessions,
    formatSessionTime,
    handleRevokeSession
  };
}
