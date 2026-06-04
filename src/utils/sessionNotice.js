const SESSION_EXPIRED_KEY = 'library_session_expired';

export const markSessionExpired = () => {
  try {
    sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
  } catch {
    /* ignore storage errors */
  }
};

export const consumeSessionExpiredNotice = () => {
  try {
    if (sessionStorage.getItem(SESSION_EXPIRED_KEY) !== '1') return false;
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return true;
  } catch {
    return false;
  }
};

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';
