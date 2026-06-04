import { useCallback } from 'react';
import { api } from '../api';
import { useSyncPolling } from './useSyncPolling';
import { dispatchLibraryDataChanged } from '../utils/libraryDataEvents';
import { refreshSharedStudentData } from '../pages/student/studentStorage';

export function useStudentAutoRefresh({ loggedIn, onSidebarRefresh, pollMs }) {
  const fetchRevision = useCallback(async () => api.getStudentSyncState(), []);

  const handleRevisionChange = useCallback(async () => {
    await refreshSharedStudentData(loggedIn);
    await onSidebarRefresh?.();
    dispatchLibraryDataChanged();
  }, [loggedIn, onSidebarRefresh]);

  useSyncPolling({
    enabled: true,
    fetchRevision,
    onRevisionChange: handleRevisionChange,
    pollMs
  });
}
