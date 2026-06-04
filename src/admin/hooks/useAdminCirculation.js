import { useCallback, useMemo, useState } from 'react';
import { api } from '../../api';
import { formatLibraryRelativeTime } from '../../utils/libraryTime';
import {
  filterBorrowRecords,
  isRecordDateToday
} from '../utils/borrowHelpers';

export function useAdminCirculation({ user }) {
  const [borrowRecords, setBorrowRecords] = useState({ active: [], returned: [] });
  const [borrowRecordCounts, setBorrowRecordCounts] = useState({ active: 0, returned: 0 });
  const [borrowRecordsLoading, setBorrowRecordsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);
  const [recentActivityError, setRecentActivityError] = useState('');
  const [activeBorrowSearch, setActiveBorrowSearch] = useState('');
  const [returnedBookSearch, setReturnedBookSearch] = useState('');

  const loadBorrowRecords = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setBorrowRecordsLoading(true);
    }
    const result = await api.getAdminBorrowRecords({
      requesterId: user.id,
      requesterEmail: user.email,
      limit: 50
    });
    if (!silent) {
      setBorrowRecordsLoading(false);
    }

    if (result.success) {
      setBorrowRecords({
        active: Array.isArray(result.active) ? result.active : [],
        returned: Array.isArray(result.returned) ? result.returned : []
      });
      setBorrowRecordCounts({
        active: Number(result.counts?.active) || 0,
        returned: Number(result.counts?.returned) || 0
      });
      return;
    }

    setBorrowRecords({ active: [], returned: [] });
    setBorrowRecordCounts({ active: 0, returned: 0 });
  }, [user.email, user.id]);

  const loadRecentActivity = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setRecentActivityLoading(true);
      setRecentActivityError('');
    }
    const result = await api.getAdminRecentCirculation({
      requesterId: user.id,
      requesterEmail: user.email,
      limit: 10
    });
    if (!silent) {
      setRecentActivityLoading(false);
    }

    if (result.success) {
      const items = Array.isArray(result.activities) ? result.activities : [];
      setRecentActivity(items.map((item) => ({
        id: `activity-${item.id}-${item.type}`,
        studentName: item.studentName,
        title: item.title,
        action: item.action,
        type: item.type,
        timeAgo: formatLibraryRelativeTime(item.activityAt)
      })));
      return;
    }

    setRecentActivity([]);
    setRecentActivityError(result.message || 'Unable to load recent activity.');
  }, [user.email, user.id]);

  const filteredActiveBorrows = useMemo(
    () => filterBorrowRecords(borrowRecords.active, activeBorrowSearch),
    [borrowRecords.active, activeBorrowSearch]
  );

  const filteredReturnedBooks = useMemo(
    () => filterBorrowRecords(borrowRecords.returned, returnedBookSearch),
    [borrowRecords.returned, returnedBookSearch]
  );

  const circulationToday = useMemo(() => {
    const issuedToday = borrowRecords.active.filter((record) => isRecordDateToday(record.borrowDate)).length;
    const returnedToday = borrowRecords.returned.filter((record) => isRecordDateToday(record.returnDate)).length;
    const overdueCount = borrowRecords.active.filter((record) => record.status === 'overdue').length;
    const dueTodayCount = borrowRecords.active.filter((record) => isRecordDateToday(record.dueDate)).length;
    return { issuedToday, returnedToday, overdueCount, dueTodayCount };
  }, [borrowRecords.active, borrowRecords.returned]);

  return {
    borrowRecords,
    borrowRecordCounts,
    borrowRecordsLoading,
    loadBorrowRecords,
    recentActivity,
    recentActivityLoading,
    recentActivityError,
    loadRecentActivity,
    activeBorrowSearch,
    setActiveBorrowSearch,
    returnedBookSearch,
    setReturnedBookSearch,
    filteredActiveBorrows,
    filteredReturnedBooks,
    circulationToday
  };
}
