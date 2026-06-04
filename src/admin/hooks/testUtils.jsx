import React from 'react';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export function renderAdminHook(callback, options = {}) {
  const wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
  return renderHook(callback, { wrapper, ...options });
}

export const adminUser = {
  id: 1,
  email: 'admin@cvsu.edu.ph',
  first_name: 'Library',
  last_name: 'Admin',
  role: 'admin',
  session_id: 'sess_admin_test'
};

export function createHookDeps(overrides = {}) {
  return {
    user: adminUser,
    setMessage: vi.fn(),
    setConfirmDialog: vi.fn(),
    showUserToast: vi.fn(),
    logAction: vi.fn(),
    setActiveSection: vi.fn(),
    securityLogs: [],
    ...overrides
  };
}
