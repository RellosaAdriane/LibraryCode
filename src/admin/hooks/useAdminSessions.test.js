import { act, renderHook } from '@testing-library/react';
import { api } from '../../api';
import { useAdminSessions } from './useAdminSessions';
import { createHookDeps } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getSessions: vi.fn(),
    revokeSession: vi.fn()
  }
}));

describe('useAdminSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessions.mockResolvedValue({
      success: true,
      sessions: [
        {
          id: 's1',
          email: 'student@cvsu.edu.ph',
          ip: '127.0.0.1',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0',
          revoked_at: null
        },
        {
          id: 's2',
          email: 'staff@cvsu.edu.ph',
          ip: '10.0.0.2',
          user_agent: 'Mozilla/5.0 (Macintosh) Safari/605.1.15',
          revoked_at: '2026-06-01T00:00:00+08:00'
        }
      ]
    });
    api.revokeSession.mockResolvedValue({ success: true });
  });

  test('loadSessions stores active and revoked sessions', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminSessions(deps));

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.sessionsLoading).toBe(false);
    expect(result.current.sessionsRefreshing).toBe(false);
  });

  test('filteredSessions respects status filter and search', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminSessions(deps));

    await act(async () => {
      await result.current.loadSessions();
    });

    expect(result.current.filteredSessions).toHaveLength(1);

    act(() => result.current.setSessionStatusFilter('all'));
    expect(result.current.filteredSessions).toHaveLength(2);

    act(() => result.current.setSessionSearch('safari'));
    expect(result.current.filteredSessions).toHaveLength(1);
    expect(result.current.filteredSessions[0].email).toBe('staff@cvsu.edu.ph');
  });

  test('handleRevokeSession confirms and revokes on success', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminSessions(deps));

    act(() => result.current.handleRevokeSession('s1', 'student@cvsu.edu.ph'));

    expect(deps.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Revoke session?'
    }));

    const dialog = deps.setConfirmDialog.mock.calls[0][0];
    await act(async () => {
      await dialog.onConfirm();
    });

    expect(api.revokeSession).toHaveBeenCalledWith({
      sessionId: 's1',
      requesterId: deps.user.id,
      requesterEmail: deps.user.email
    });
    expect(deps.showUserToast).toHaveBeenCalledWith('Session revoked successfully.');
    expect(deps.logAction).toHaveBeenCalledWith('Session Revoked', 's1');
  });
});
