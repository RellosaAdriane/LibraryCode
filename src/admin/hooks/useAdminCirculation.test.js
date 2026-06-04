import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../../api';
import { formatLibraryDate } from '../../utils/libraryTime';
import { useAdminCirculation } from './useAdminCirculation';
import { adminUser } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getAdminBorrowRecords: vi.fn(),
    getAdminRecentCirculation: vi.fn()
  }
}));

describe('useAdminCirculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const today = formatLibraryDate();
    api.getAdminBorrowRecords.mockResolvedValue({
      success: true,
      active: [
        { id: 1, studentName: 'Ana', title: 'Book A', borrowDate: today, dueDate: today, status: 'active' },
        { id: 2, studentName: 'Ben', title: 'Book B', borrowDate: '1999-01-01', dueDate: today, status: 'overdue' }
      ],
      returned: [
        { id: 3, studentName: 'Cal', title: 'Book C', returnDate: today }
      ],
      counts: { active: 2, returned: 1 }
    });
    api.getAdminRecentCirculation.mockResolvedValue({
      success: true,
      activities: [{
        id: 9,
        type: 'borrow',
        studentName: 'Ana',
        title: 'Book A',
        action: 'borrowed',
        activityAt: `${today}T08:00:00+08:00`
      }]
    });
  });

  test('loadBorrowRecords and loadRecentActivity populate circulation state', async () => {
    const { result } = renderHook(() => useAdminCirculation({ user: adminUser }));

    await act(async () => {
      await result.current.loadBorrowRecords();
      await result.current.loadRecentActivity();
    });

    expect(result.current.borrowRecordCounts).toEqual({ active: 2, returned: 1 });
    expect(result.current.recentActivity).toHaveLength(1);
    expect(result.current.recentActivity[0].studentName).toBe('Ana');
    expect(result.current.borrowRecordsLoading).toBe(false);
    expect(result.current.recentActivityLoading).toBe(false);
  });

  test('filters active borrows by search query', async () => {
    const { result } = renderHook(() => useAdminCirculation({ user: adminUser }));

    await act(async () => {
      await result.current.loadBorrowRecords();
    });

    act(() => result.current.setActiveBorrowSearch('ben'));
    expect(result.current.filteredActiveBorrows).toHaveLength(1);
    expect(result.current.filteredActiveBorrows[0].studentName).toBe('Ben');
  });

  test('computes circulationToday metrics from loaded records', async () => {
    const { result } = renderHook(() => useAdminCirculation({ user: adminUser }));

    await act(async () => {
      await result.current.loadBorrowRecords();
    });

    expect(result.current.circulationToday).toMatchObject({
      issuedToday: 1,
      returnedToday: 1,
      overdueCount: 1,
      dueTodayCount: 2
    });
  });

  test('stores recent activity error message on failure', async () => {
    api.getAdminRecentCirculation.mockResolvedValueOnce({
      success: false,
      message: 'Circulation unavailable'
    });

    const { result } = renderHook(() => useAdminCirculation({ user: adminUser }));

    await act(async () => {
      await result.current.loadRecentActivity();
    });

    await waitFor(() => {
      expect(result.current.recentActivityError).toBe('Circulation unavailable');
      expect(result.current.recentActivity).toEqual([]);
    });
  });

  test('silent refresh keeps loading flags false while updating data', async () => {
    const { result } = renderHook(() => useAdminCirculation({ user: adminUser }));

    await act(async () => {
      await result.current.loadBorrowRecords();
      await result.current.loadRecentActivity();
    });

    expect(result.current.borrowRecordsLoading).toBe(false);
    expect(result.current.recentActivityLoading).toBe(false);

    await act(async () => {
      await result.current.loadBorrowRecords({ silent: true });
      await result.current.loadRecentActivity({ silent: true });
    });

    expect(result.current.borrowRecordsLoading).toBe(false);
    expect(result.current.recentActivityLoading).toBe(false);
    expect(result.current.borrowRecordCounts.active).toBe(2);
    expect(result.current.recentActivity).toHaveLength(1);
  });
});
