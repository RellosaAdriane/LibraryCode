import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('./api', () => ({
  api: {
    requestPasswordResetOtp: vi.fn(),
    checkPasswordResetOtp: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock('./auth', () => ({
  clearAuth: vi.fn(),
}));

import { api } from './api';

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.requestPasswordResetOtp.mockResolvedValue({
      success: true,
      message: 'If this email exists in our system, we sent a verification code.',
      masked_email: 't***r@cvsu.edu.ph',
      cooldown_seconds: 60,
    });
    api.checkPasswordResetOtp.mockResolvedValue({
      success: true,
      message: 'Code verified. Create your new password.',
    });
    api.resetPassword.mockResolvedValue({
      success: true,
      message: 'Password reset successful. Please log in with your new password.',
    });
  });

  test('step 1 shows only the email field', () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
  });

  test('advances to OTP step after sending the code', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'teacher@cvsu.edu.ph' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

    await waitFor(() => {
      expect(document.getElementById('forgot-title')).toHaveTextContent('Verify Code');
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();
    expect(api.requestPasswordResetOtp).toHaveBeenCalledWith('teacher@cvsu.edu.ph');
  });

  test('advances to password step only after OTP verification', async () => {
    render(
      <MemoryRouter>
        <ForgotPassword />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'teacher@cvsu.edu.ph' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send verification code/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(document.getElementById('forgot-title')).toHaveTextContent('New Password');
      expect(document.getElementById('fp-password')).toBeInTheDocument();
      expect(document.getElementById('fp-confirm-password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    expect(api.checkPasswordResetOtp).toHaveBeenCalledWith('teacher@cvsu.edu.ph', '123456');
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });
});
