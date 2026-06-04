import { act, waitFor } from '@testing-library/react';
import { api } from '../../api';
import { getStoredUser } from '../../auth';
import { dispatchLibraryDataChanged } from '../../utils/libraryDataEvents';
import { useAdminDashboard } from './useAdminDashboard';
import { renderAdminHook } from './testUtils';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('../../hooks/useLibraryClock', () => ({
  useLibraryClock: () => ({
    full: 'Jun 03, 2026, 10:00:00 AM',
    compact: 'Jun 3, 10:00 AM',
    title: 'Library time',
    syncNotice: 'Library time synced'
  })
}));

vi.mock('../../auth', () => ({
  getStoredUser: vi.fn(),
  clearAuth: vi.fn(),
  updateStoredUser: vi.fn()
}));

vi.mock('../../api', () => ({
  api: {
    validateSession: vi.fn(() => Promise.resolve({ success: true, active: true })),
    touchSession: vi.fn(() => Promise.resolve({ success: true })),
    getBooks: vi.fn(() => Promise.resolve({ success: true, books: [] })),
    getAdminBorrowRecords: vi.fn(() => Promise.resolve({
      success: true,
      active: [],
      returned: [],
      counts: { active: 0, returned: 0 }
    })),
    getAdminRecentCirculation: vi.fn(() => Promise.resolve({ success: true, activities: [] })),
    getStudentActivities: vi.fn(() => Promise.resolve({ success: true, activities: [] })),
    getSignupSettings: vi.fn(() => Promise.resolve({
      success: true,
      settings: { email_verification_enabled: true }
    })),
    getPenaltySettings: vi.fn(() => Promise.resolve({
      success: true,
      settings: { grace_days: 7, daily_fee: 150, block_overdue_days: 14 }
    })),
    getAnnouncementSettings: vi.fn(() => Promise.resolve({
      success: true,
      settings: { enabled: false, title: 'Library Notice', message: '' }
    })),
    getSecurityLogs: vi.fn(() => Promise.resolve({ success: true, logs: [] })),
    getSsoSettings: vi.fn(() => Promise.resolve({
      success: true,
      settings: {
        enabled: false,
        provider_name: 'SSO / LDAP',
        allowed_domains: [],
        admin_only: false
      }
    })),
    getAdmin2faSettings: vi.fn(() => Promise.resolve({
      success: true,
      settings: { enabled: false }
    })),
    getUsers: vi.fn(() => Promise.resolve({ success: true, users: [] })),
    getSessions: vi.fn(() => Promise.resolve({ success: true, sessions: [] })),
    getAdminSyncState: vi.fn(() => Promise.resolve({ success: true, revision: 'rev-initial' }))
  }
}));

describe('useAdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredUser.mockReturnValue({
      id: 1,
      email: 'admin@cvsu.edu.ph',
      first_name: 'Library',
      last_name: 'Admin',
      role: 'admin',
      session_id: 'sess_test'
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
  });

  test('composes domain hooks into the flattened admin API', async () => {
    const { result } = renderAdminHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeSection).toBe('home');
    expect(result.current.menuItems).toHaveLength(8);
    expect(result.current.dashboardInsights).toMatchObject({
      displayName: 'Library',
      greeting: expect.any(String),
      lines: expect.any(Array)
    });
    expect(result.current.SETTINGS_TABS.length).toBeGreaterThan(0);
    expect(typeof result.current.handleHeaderRefresh).toBe('function');
    expect(typeof result.current.loadBooks).toBe('function');
    expect(typeof result.current.loadUsers).toBe('function');
    expect(typeof result.current.handleRevokeSession).toBe('function');
  });

  test('handleHeaderRefresh reloads section-specific data', async () => {
    const { result } = renderAdminHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();

    act(() => result.current.setActiveSection('users'));
    act(() => {
      result.current.handleHeaderRefresh();
    });

    await waitFor(() => {
      expect(api.getBooks).toHaveBeenCalled();
      expect(api.getAdminBorrowRecords).toHaveBeenCalled();
      expect(api.getAdminRecentCirculation).toHaveBeenCalled();
      expect(api.getUsers).toHaveBeenCalled();
    });
  });

  test('loads sessions when settings section becomes active', async () => {
    const { result } = renderAdminHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();

    act(() => result.current.setActiveSection('settings'));

    await waitFor(() => {
      expect(api.getSessions).toHaveBeenCalled();
    });
  });

  test('library data changes refresh circulation on home without reloading books', async () => {
    const { result } = renderAdminHook(() => useAdminDashboard());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    vi.clearAllMocks();

    act(() => {
      dispatchLibraryDataChanged({ source: 'return' });
    });

    await waitFor(() => {
      expect(api.getAdminBorrowRecords).toHaveBeenCalled();
      expect(api.getAdminRecentCirculation).toHaveBeenCalled();
      expect(api.getBooks).not.toHaveBeenCalled();
    });
  });

  test('auto refresh reloads circulation when sync revision changes on home', async () => {
    api.getAdminSyncState
      .mockResolvedValueOnce({ success: true, revision: 'rev-1' })
      .mockResolvedValueOnce({ success: true, revision: 'rev-2' });

    renderAdminHook(() => useAdminDashboard());

    await act(async () => {
      await Promise.resolve();
    });

    vi.clearAllMocks();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 2100));
    });

    await waitFor(() => {
      expect(api.getAdminBorrowRecords).toHaveBeenCalled();
      expect(api.getAdminRecentCirculation).toHaveBeenCalled();
    });
  });
});
