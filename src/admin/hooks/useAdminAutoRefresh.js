import { useCallback } from 'react';
import { api } from '../../api';
import { useSyncPolling } from '../../hooks/useSyncPolling';

export function useAdminAutoRefresh({ user, onDataChanged, pollMs }) {
  const fetchRevision = useCallback(async () => {
    if (!user?.id || !user?.email) {
      return { success: false };
    }

    return api.getAdminSyncState({
      requesterId: user.id,
      requesterEmail: user.email
    });
  }, [user?.id, user?.email]);

  useSyncPolling({
    enabled: Boolean(user?.id && user?.email),
    fetchRevision,
    onRevisionChange: onDataChanged,
    pollMs
  });
}
