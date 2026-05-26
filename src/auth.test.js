import { getUserRole, isAuthenticated } from './auth';

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
});
