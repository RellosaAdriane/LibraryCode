import { clearAuth, getUserRole, isAuthenticated } from './auth';

describe('auth storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('does not authenticate stale user data without a session id', () => {
    localStorage.setItem('user', JSON.stringify({
      id: 1,
      email: 'student@example.com',
      role: 'student'
    }));

    expect(isAuthenticated()).toBe(false);
    expect(getUserRole()).toBeNull();
  });

  test('authenticates and resolves role from a stored server session', () => {
    sessionStorage.setItem('user', JSON.stringify({
      id: 2,
      email: 'admin@example.com',
      role: 'admin',
      session_id: 'sess_test'
    }));

    expect(isAuthenticated()).toBe(true);
    expect(getUserRole()).toBe('admin');
  });

  test('notifies listeners when auth is cleared', () => {
    const listener = vi.fn();
    sessionStorage.setItem('user', JSON.stringify({
      id: 3,
      email: 'student@example.com',
      role: 'student',
      session_id: 'sess_test'
    }));
    window.addEventListener('user-updated', listener);

    clearAuth();

    expect(isAuthenticated()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toBeNull();

    window.removeEventListener('user-updated', listener);
  });
});
