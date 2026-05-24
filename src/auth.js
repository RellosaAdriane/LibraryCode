export const getStoredUser = () => {
  const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

export const updateStoredUser = (nextUser) => {
  const current = getStoredUser();
  if (!current) return null;

  const updated = { ...current, ...nextUser };
  const serialized = JSON.stringify(updated);

  if (sessionStorage.getItem('user')) {
    sessionStorage.setItem('user', serialized);
  }
  if (localStorage.getItem('user')) {
    localStorage.setItem('user', serialized);
  }

  window.dispatchEvent(new CustomEvent('user-updated', { detail: updated }));
  return updated;
};

export const isAuthenticated = () => getStoredUser() !== null;

export const getUserRole = () => {
  const user = getStoredUser();
  if (!user) return null;
  return user.role === 'admin' ? 'admin' : 'student';
};

export const clearAuth = () => {
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};
