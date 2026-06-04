import { act } from '@testing-library/react';
import { api } from '../api';
import { dispatchLibraryDataChanged } from '../utils/libraryDataEvents';
import { refreshSharedStudentData } from '../pages/student/studentStorage';
import { useStudentAutoRefresh } from './useStudentAutoRefresh';
import { renderAdminHook } from '../admin/hooks/testUtils';

vi.mock('../api', () => ({
  api: {
    getStudentSyncState: vi.fn(() => Promise.resolve({ success: true, revision: 'rev-1' }))
  }
}));

vi.mock('../pages/student/studentStorage', () => ({
  refreshSharedStudentData: vi.fn(() => Promise.resolve({ success: true }))
}));

vi.mock('../utils/libraryDataEvents', async () => {
  const actual = await vi.importActual('../utils/libraryDataEvents');
  return {
    ...actual,
    dispatchLibraryDataChanged: vi.fn(actual.dispatchLibraryDataChanged)
  };
});

describe('useStudentAutoRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });
  });

  test('does not dispatch on the initial sync check', async () => {
    renderAdminHook(() => useStudentAutoRefresh({
      loggedIn: true,
      onSidebarRefresh: vi.fn(),
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.getStudentSyncState).toHaveBeenCalledTimes(1);
    expect(refreshSharedStudentData).not.toHaveBeenCalled();
    expect(dispatchLibraryDataChanged).not.toHaveBeenCalled();
  });

  test('refreshes shared data and sidebar when revision changes', async () => {
    const onSidebarRefresh = vi.fn();
    api.getStudentSyncState
      .mockResolvedValueOnce({ success: true, revision: 'rev-1' })
      .mockResolvedValueOnce({ success: true, revision: 'rev-2' });

    renderAdminHook(() => useStudentAutoRefresh({
      loggedIn: true,
      onSidebarRefresh,
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(refreshSharedStudentData).toHaveBeenCalledWith(true);
    expect(onSidebarRefresh).toHaveBeenCalledTimes(1);
    expect(dispatchLibraryDataChanged).toHaveBeenCalledTimes(1);
  });

  test('passes loggedIn=false to refreshSharedStudentData for guests', async () => {
    api.getStudentSyncState
      .mockResolvedValueOnce({ success: true, revision: 'rev-1' })
      .mockResolvedValueOnce({ success: true, revision: 'rev-2' });

    renderAdminHook(() => useStudentAutoRefresh({
      loggedIn: false,
      onSidebarRefresh: vi.fn(),
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(refreshSharedStudentData).toHaveBeenCalledWith(false);
  });
});
