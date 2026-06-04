import { act } from '@testing-library/react';
import { api } from '../../api';
import { useAdminAutoRefresh } from './useAdminAutoRefresh';
import { renderAdminHook } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getAdminSyncState: vi.fn(() => Promise.resolve({ success: true, revision: 'rev-1' }))
  }
}));

describe('useAdminAutoRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });
  });

  test('does not refresh on the initial sync check', async () => {
    const onDataChanged = vi.fn();

    renderAdminHook(() => useAdminAutoRefresh({
      user: { id: 1, email: 'admin@cvsu.edu.ph' },
      onDataChanged,
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.getAdminSyncState).toHaveBeenCalledTimes(1);
    expect(onDataChanged).not.toHaveBeenCalled();
  });

  test('refreshes when the sync revision changes', async () => {
    const onDataChanged = vi.fn();
    api.getAdminSyncState
      .mockResolvedValueOnce({ success: true, revision: 'rev-1' })
      .mockResolvedValueOnce({ success: true, revision: 'rev-2' });

    renderAdminHook(() => useAdminAutoRefresh({
      user: { id: 1, email: 'admin@cvsu.edu.ph' },
      onDataChanged,
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  test('checks for updates when the tab becomes visible again', async () => {
    const onDataChanged = vi.fn();

    renderAdminHook(() => useAdminAutoRefresh({
      user: { id: 1, email: 'admin@cvsu.edu.ph' },
      onDataChanged,
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.getAdminSyncState).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(api.getAdminSyncState).toHaveBeenCalledTimes(2);
  });

  test('does not poll when admin user is missing', async () => {
    renderAdminHook(() => useAdminAutoRefresh({
      user: {},
      onDataChanged: vi.fn(),
      pollMs: 50
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(api.getAdminSyncState).not.toHaveBeenCalled();
  });
});
