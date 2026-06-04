import {
  consumeSessionExpiredNotice,
  markSessionExpired,
  SESSION_EXPIRED_MESSAGE
} from './sessionNotice';

describe('sessionNotice helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('markSessionExpired sets a one-time notice flag', () => {
    markSessionExpired();
    expect(sessionStorage.getItem('library_session_expired')).toBe('1');
  });

  test('consumeSessionExpiredNotice reads and clears the flag', () => {
    markSessionExpired();
    expect(consumeSessionExpiredNotice()).toBe(true);
    expect(consumeSessionExpiredNotice()).toBe(false);
  });

  test('exports a user-facing message', () => {
    expect(SESSION_EXPIRED_MESSAGE).toMatch(/session expired/i);
  });
});
