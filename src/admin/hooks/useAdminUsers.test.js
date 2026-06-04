import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../../api';
import { useAdminUsers } from './useAdminUsers';
import { createHookDeps } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getUsers: vi.fn(),
    getSessions: vi.fn(),
    getAdminUserBorrows: vi.fn(),
    updateUserRole: vi.fn()
  }
}));

vi.mock('../../auth', () => ({
  updateStoredUser: vi.fn()
}));

const sampleUsers = [
  {
    id: 1,
    first_name: 'Library',
    last_name: 'Admin',
    email: 'admin@cvsu.edu.ph',
    role: 'admin',
    affiliation: 'faculty',
    institution_id: 'ADM001',
    created_at: '2026-06-01T00:00:00+08:00'
  },
  {
    id: 2,
    first_name: 'Student',
    last_name: 'One',
    email: 'student@cvsu.edu.ph',
    role: 'student',
    affiliation: 'student',
    institution_id: 'STU001',
    created_at: '2026-05-20T00:00:00+08:00'
  },
  {
    id: 3,
    first_name: 'Staff',
    last_name: 'Member',
    email: 'staff@cvsu.edu.ph',
    role: 'student',
    affiliation: 'staff',
    institution_id: 'STF001',
    created_at: '2026-05-10T00:00:00+08:00'
  }
];

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    api.getUsers.mockResolvedValue({ success: true, users: sampleUsers });
    api.getSessions.mockResolvedValue({ success: true, sessions: [] });
    api.getAdminUserBorrows.mockResolvedValue({ success: true, borrows: [] });
  });

  test('loadUsers stores registered users and computes stats', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminUsers(deps));

    await act(async () => {
      await result.current.loadUsers();
    });

    expect(result.current.users).toHaveLength(3);
    expect(result.current.userStats).toMatchObject({
      total: 3,
      students: 2,
      admins: 1,
      staff: 1
    });
    expect(result.current.usersLoading).toBe(false);
  });

  test('applyUserRoleFilter and debounced search narrow the user list', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminUsers(deps));

    await act(async () => {
      await result.current.loadUsers();
    });

    act(() => result.current.applyUserRoleFilter('student'));
    expect(result.current.userRoleFilter).toBe('student');
    expect(result.current.filteredUsers.every((entry) => entry.role === 'student')).toBe(true);

    act(() => result.current.setUserSearch('staff@cvsu.edu.ph'));

    await waitFor(() => {
      expect(result.current.debouncedUserSearch).toBe('staff@cvsu.edu.ph');
    });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].email).toBe('staff@cvsu.edu.ph');
  });

  test('toggleUserSort switches field and direction', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminUsers(deps));

    await act(async () => {
      await result.current.loadUsers();
    });

    act(() => result.current.toggleUserSort('name'));
    expect(result.current.userSortField).toBe('name');
    expect(result.current.userSortDir).toBe('asc');

    act(() => result.current.toggleUserSort('name'));
    expect(result.current.userSortDir).toBe('desc');
  });

  test('requestRoleChange opens confirm dialog before updating role', async () => {
    api.updateUserRole.mockResolvedValueOnce({ success: true });
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminUsers(deps));

    await act(async () => {
      await result.current.loadUsers();
    });

    const target = sampleUsers[1];
    act(() => result.current.requestRoleChange(target, 'admin'));

    expect(deps.setConfirmDialog).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Confirm role change'
    }));

    const dialog = deps.setConfirmDialog.mock.calls[0][0];
    await act(async () => {
      await dialog.onConfirm();
    });

    expect(api.updateUserRole).toHaveBeenCalledWith({
      id: target.id,
      role: 'admin',
      requester_id: deps.user.id,
      requester_email: deps.user.email
    });
    expect(deps.logAction).toHaveBeenCalledWith('User Role Updated', `${target.email} -> admin`);
  });
});
