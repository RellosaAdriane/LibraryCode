import { act } from '@testing-library/react';
import { useSyncPolling } from './useSyncPolling';
import { renderAdminHook } from '../admin/hooks/testUtils';

describe('useSyncPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });
  });

  test('calls onRevisionChange when revision changes after baseline', async () => {
    const fetchRevision = vi.fn()
      .mockResolvedValueOnce({ success: true, revision: 'rev-1' })
      .mockResolvedValueOnce({ success: true, revision: 'rev-2' });
    const onRevisionChange = vi.fn();

    renderAdminHook(() => useSyncPolling({
      enabled: true,
      fetchRevision,
      onRevisionChange,
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(onRevisionChange).toHaveBeenCalledTimes(1);
  });

  test('does not poll when disabled', async () => {
    const fetchRevision = vi.fn().mockResolvedValue({ success: true, revision: 'rev-1' });

    renderAdminHook(() => useSyncPolling({
      enabled: false,
      fetchRevision,
      onRevisionChange: vi.fn(),
      pollMs: 50
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 60));
    });

    expect(fetchRevision).not.toHaveBeenCalled();
  });

  test('skips fetch while tab is hidden but polls again when visible', async () => {
    const fetchRevision = vi.fn().mockResolvedValue({ success: true, revision: 'rev-1' });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden'
    });

    renderAdminHook(() => useSyncPolling({
      enabled: true,
      fetchRevision,
      onRevisionChange: vi.fn(),
      pollMs: 50
    }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchRevision).not.toHaveBeenCalled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible'
    });

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(fetchRevision).toHaveBeenCalledTimes(1);
  });

  test('checks for updates when the window regains focus', async () => {
    const fetchRevision = vi.fn().mockResolvedValue({ success: true, revision: 'rev-1' });

    renderAdminHook(() => useSyncPolling({
      enabled: true,
      fetchRevision,
      onRevisionChange: vi.fn(),
      pollMs: 5000
    }));

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(fetchRevision).toHaveBeenCalledTimes(2);
  });
});
