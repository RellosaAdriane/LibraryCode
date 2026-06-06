import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './login';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/login', state: null, search: '', hash: '' }),
  };
});

vi.mock('./api', () => ({
  api: {
    getSignupSettings: vi.fn(),
    getSsoSettings: vi.fn(),
    getGoogleConfig: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    requestSignupOtp: vi.fn(),
    verifySignupOtp: vi.fn(),
    googleAuth: vi.fn(),
    ssoLogin: vi.fn(),
  },
}));

vi.mock('./auth', () => ({
  clearAuth: vi.fn(),
  getStoredUser: vi.fn(),
}));

vi.mock('./utils/sessionNotice', () => ({
  consumeSessionExpiredNotice: vi.fn(() => false),
  SESSION_EXPIRED_MESSAGE: 'Session expired',
}));

import { api } from './api';
import { getStoredUser } from './auth';

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login admin verification flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();

    api.getSignupSettings.mockResolvedValue({
      success: true,
      settings: { email_verification_enabled: true },
    });
    api.getSsoSettings.mockResolvedValue({
      success: true,
      settings: { enabled: false, provider_name: 'SSO / LDAP', allowed_domains: [] },
    });
    api.getGoogleConfig.mockResolvedValue({
      success: true,
      client_id: '',
    });
    api.login.mockResolvedValue({
      success: true,
      requires_2fa: true,
      challenge_id: 'challenge-test-123',
      message: 'OTP sent to your admin email. It expires in 5 minutes.',
    });
    getStoredUser.mockReturnValue(null);
  });

  test('does not show admin OTP stepper on the initial login screen', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('2. Verify OTP')).not.toBeInTheDocument();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  test('shows OTP step after admin credentials succeed', async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'admin@cvsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'AdminPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(screen.getByText('Verify OTP')).toBeInTheDocument();
      expect(screen.getByText('2. Verify OTP')).toBeInTheDocument();
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith('admin@cvsu.edu.ph', 'AdminPass1!');
  });

  test('submits OTP verification with stored credentials', async () => {
    getStoredUser.mockReturnValue({
      id: 11,
      email: 'admin@cvsu.edu.ph',
      role: 'admin',
      session_id: 'sess_admin_test',
    });
    api.login
      .mockResolvedValueOnce({
        success: true,
        requires_2fa: true,
        challenge_id: 'challenge-test-123',
        message: 'OTP sent to your admin email. It expires in 5 minutes.',
      })
      .mockResolvedValueOnce({
        success: true,
        user: {
          id: 11,
          email: 'admin@cvsu.edu.ph',
          role: 'admin',
          session_id: 'sess_admin_test',
        },
      });

    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'admin@cvsu.edu.ph' },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'AdminPass1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '829459' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify login/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenLastCalledWith('admin@cvsu.edu.ph', 'AdminPass1!', {
        otp: '829459',
        challenge_id: 'challenge-test-123',
      });
    });
  });
});
