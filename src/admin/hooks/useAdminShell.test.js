import { act, waitFor } from '@testing-library/react';
import { clearAuth, getStoredUser } from '../../auth';
import { useAdminShell } from './useAdminShell';
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
  clearAuth: vi.fn()
}));

vi.mock('../../api', () => ({
  api: {
    validateSession: vi.fn(() => Promise.resolve({ success: true, active: true })),
    touchSession: vi.fn(() => Promise.resolve({ success: true }))
  }
}));

describe('useAdminShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStoredUser.mockReturnValue({
      id: 1,
      email: 'admin@cvsu.edu.ph',
      first_name: 'Library',
      session_id: 'sess_test'
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
  });

  test('returns desktop page titles and menu items', () => {
    const { result } = renderAdminHook(() => useAdminShell());

    expect(result.current.getPageTitle()).toBe('Admin Dashboard Home');
    expect(result.current.menuItems).toHaveLength(8);

    act(() => result.current.setActiveSection('books'));
    expect(result.current.getPageTitle()).toBe('Book Management');
  });

  test('clears message when active section changes', () => {
    const { result } = renderAdminHook(() => useAdminShell());

    act(() => result.current.setMessage('Saved book.'));
    expect(result.current.message).toBe('Saved book.');

    act(() => result.current.setActiveSection('users'));
    expect(result.current.message).toBe('');
  });

  test('showUserToast prefixes success and error states', () => {
    const { result } = renderAdminHook(() => useAdminShell());

    act(() => result.current.showUserToast('Updated'));
    expect(result.current.userToast).toBe('✅ Updated');

    act(() => result.current.showUserToast('Failed', true));
    expect(result.current.userToast).toBe('❌ Failed');
  });

  test('handleLogout clears auth and navigates to login', () => {
    const { result } = renderAdminHook(() => useAdminShell());

    act(() => result.current.handleLogout());

    expect(clearAuth).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  test('uses short titles on mobile widths', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
    window.dispatchEvent(new Event('resize'));

    const { result } = renderAdminHook(() => useAdminShell());

    await waitFor(() => {
      expect(result.current.isMobile).toBe(true);
    });

    act(() => result.current.setActiveSection('circulation'));
    expect(result.current.getPageTitle()).toBe('Circulation');
  });
});
