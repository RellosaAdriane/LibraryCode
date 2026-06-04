import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../../api';
import { useAdminActivity } from './useAdminActivity';
import { createHookDeps } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getStudentActivities: vi.fn(),
    getSecurityLogs: vi.fn()
  }
}));

describe('useAdminActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.getStudentActivities.mockResolvedValue({ success: true, activities: [] });
    api.getSecurityLogs.mockResolvedValue({ success: true, logs: [{ event: 'login_success' }] });
  });

  test('logAction prepends an admin activity entry', () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminActivity(deps));

    act(() => result.current.logAction('Book Added', 'Algorithms'));

    expect(result.current.activityLog).toHaveLength(1);
    expect(result.current.activityLog[0]).toMatchObject({
      action: 'Book Added',
      details: 'Algorithms',
      adminName: 'Library Admin'
    });
  });

  test('loadSecurityLogs stores logs or reports failure', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminActivity(deps));

    await act(async () => {
      await result.current.loadSecurityLogs();
    });

    expect(result.current.securityLogs).toEqual([{ event: 'login_success' }]);
    expect(result.current.securityLogsLoading).toBe(false);

    api.getSecurityLogs.mockResolvedValueOnce({ success: false, message: 'Denied' });
    await act(async () => {
      await result.current.loadSecurityLogs();
    });
    expect(deps.setMessage).toHaveBeenCalledWith('Denied');
  });

  test('handleClearActivityLog opens confirm dialog and clears on confirm', () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminActivity(deps));

    act(() => result.current.logAction('Test', 'One'));
    act(() => result.current.handleClearActivityLog());

    expect(deps.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Clear activity log?'
    }));

    const dialog = deps.setConfirmDialog.mock.calls[0][0];
    act(() => dialog.onConfirm());

    expect(result.current.activityLog).toEqual([]);
    expect(deps.showUserToast).toHaveBeenCalledWith('Activity log cleared.');
  });

  test('loadStudentActivity merges server and local student entries', async () => {
    api.getStudentActivities.mockResolvedValueOnce({
      success: true,
      activities: [{
        email: 'student@cvsu.edu.ph',
        action: 'Borrowed',
        details: 'Book A',
        time: '2026-06-03',
        timestamp: 1
      }]
    });
    localStorage.setItem('library.student.student@cvsu.edu.ph.activity', JSON.stringify([
      { action: 'Returned', book_title: 'Book B', timestamp: 2, time: '2026-06-02' }
    ]));

    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminActivity(deps));

    act(() => {
      result.current.loadStudentActivity();
    });

    await waitFor(() => {
      expect(result.current.studentActivityLog.length).toBeGreaterThanOrEqual(2);
    });
  });
});
