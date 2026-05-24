import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './login.css';
import { api } from './api';
import { clearAuth } from './auth';

const getPasswordStrength = (value) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score <= 2) return { label: 'Weak', className: 'weak' };
  if (score <= 4) return { label: 'Medium', className: 'medium' };
  return { label: 'Strong', className: 'strong' };
};

const normalizeResetMessage = (message) => {
  const text = String(message || '').trim();
  if (!text) return 'Unable to process your request right now. Please try again.';

  if (text.toLowerCase() === 'invalid code.' || text.toLowerCase().includes('invalid code')) {
    return 'The verification code is incorrect. Please check the code and try again.';
  }

  if (text.toLowerCase().includes('old password')) {
    return 'For security, do not reuse your old password. Please create a new one.';
  }

  return text;
};

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('info');
  const [summaryErrors, setSummaryErrors] = useState([]);
  const [emailError, setEmailError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const resetMessages = () => {
    setSummaryErrors([]);
    setStatusMessage('');
    setStatusType('info');
  };

  const validateEmail = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      return false;
    }

    const allowedDomains = ['cvsu.edu.ph', 'gmail.com', 'yahoo.com'];
    const parts = trimmed.split('@');
    if (parts.length !== 2 || !allowedDomains.includes(parts[1].toLowerCase())) {
      setEmailError('Use cvsu.edu.ph, gmail.com, or yahoo.com email.');
      return false;
    }

    setEmailError('');
    return true;
  };

  const validateStepTwo = () => {
    const errors = [];
    const passwordStrength = getPasswordStrength(newPassword);

    if (!/^\d{6}$/.test(otp)) {
      errors.push('Enter a valid 6-digit verification code.');
      setOtpError('Enter a valid 6-digit code.');
    } else {
      setOtpError('');
    }

    if (newPassword.length < 8 || newPassword.length > 16 || /\s/.test(newPassword)) {
      errors.push('Password must be 8 to 16 characters without spaces.');
      setPasswordError('8-16 chars, no spaces.');
    } else if (passwordStrength.className === 'weak') {
      errors.push('Weak password detected. Use a medium or strong password.');
      setPasswordError('Use medium or strong password.');
    } else {
      setPasswordError('');
    }

    if (confirmPassword !== newPassword) {
      errors.push('Confirm password must match new password.');
      setConfirmError('Passwords do not match.');
    } else {
      setConfirmError('');
    }

    setSummaryErrors(errors);
    return errors.length === 0;
  };

  const handleSendOtp = async () => {
    resetMessages();
    if (!validateEmail()) {
      setSummaryErrors(['Fix the email field before continuing.']);
      return;
    }

    setLoading(true);
    const result = await api.requestPasswordResetOtp(email.trim());
    setLoading(false);

    setStatusMessage(normalizeResetMessage(result.message || 'If this email exists in our system, we sent a verification code.'));
    setStatusType(result.success ? 'success' : 'error');

    if (result.cooldown_seconds) {
      setCooldownSeconds(Number(result.cooldown_seconds) || 0);
    }

    if (result.masked_email) {
      setMaskedEmail(result.masked_email);
    }

    if (result.success) {
      setStep(2);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      clearAuth();
    }
  };

  const handleResetPassword = async () => {
    resetMessages();
    if (!validateStepTwo()) {
      return;
    }

    setLoading(true);
    const result = await api.resetPassword(email.trim(), otp, newPassword);
    setLoading(false);

    setStatusMessage(normalizeResetMessage(result.message || (result.success ? 'Password reset successful.' : 'Failed to reset password.')));
    setStatusType(result.success ? 'success' : 'error');

    if (result.success) {
      clearAuth();
      setTimeout(() => navigate('/login', { replace: true }), 1000);
    }
  };

  return (
    <div className="container fp-page" aria-labelledby="forgot-title">
      <div className="fp-brand">Library System</div>

      <div className="header">
        <div id="forgot-title" className="text">Forgot Password</div>
        <div className="underline"></div>
      </div>

      <div className="fp-stepper" aria-label="Password reset progress">
        <div className={`fp-step ${step >= 1 ? 'active' : ''}`}>1. Verify Email</div>
        <div className={`fp-step ${step >= 2 ? 'active' : ''}`}>2. Reset Password</div>
      </div>

      {summaryErrors.length > 0 && (
        <div className="fp-alert fp-alert-error" role="alert" aria-live="assertive">
          {summaryErrors.map((err) => (
            <div key={err}>{err}</div>
          ))}
        </div>
      )}

      {statusMessage && (
        <div className={`fp-alert ${statusType === 'success' ? 'fp-alert-success' : 'fp-alert-error'}`} role="status" aria-live="polite">
          {statusMessage}
        </div>
      )}

      <div className="inputs fp-inputs">
        <div className="input fp-field-wrap">
          <label htmlFor="fp-email">Email Address</label>
          <input
            id="fp-email"
            type="email"
            placeholder="name@domain.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail();
            }}
            onBlur={validateEmail}
            disabled={step === 2}
            aria-describedby={emailError ? 'fp-email-error' : 'fp-email-help'}
            aria-invalid={emailError ? 'true' : 'false'}
          />
          <small id="fp-email-help">We'll send a one-time code to this address.</small>
          {emailError && <small id="fp-email-error" className="fp-error">{emailError}</small>}
        </div>

        {step === 2 && (
          <>
            <div className="fp-chip">Code sent to {maskedEmail || 'your email'}</div>

            <div className="input fp-field-wrap">
              <label htmlFor="fp-otp">Verification Code</label>
              <input
                id="fp-otp"
                type="text"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (otpError) setOtpError('');
                }}
                maxLength={6}
                aria-describedby={otpError ? 'fp-otp-error' : 'fp-otp-help'}
                aria-invalid={otpError ? 'true' : 'false'}
              />
              <small id="fp-otp-help">Code expires in 5 minutes.</small>
              {otpError && <small id="fp-otp-error" className="fp-error">{otpError}</small>}
            </div>

            <div className="input fp-field-wrap fp-password-wrap">
              <label htmlFor="fp-password">Password</label>
              <div className="fp-password-row">
                <input
                  id="fp-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Create password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  maxLength={16}
                  aria-describedby={passwordError ? 'fp-password-error' : 'fp-password-help'}
                  aria-invalid={passwordError ? 'true' : 'false'}
                />
                <button
                  type="button"
                  className="fp-eye-btn"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <small id="fp-password-help">8-16 chars, include upper/lowercase, number, special character.</small>
              <div className="fp-strength">
                <div className={`fp-strength-bar ${strength.className}`}></div>
                <span>{strength.label}</span>
              </div>
              <ul className="fp-password-list">
                <li className={newPassword.length >= 8 ? 'ok' : ''}>At least 8 characters</li>
                <li className={/[A-Z]/.test(newPassword) ? 'ok' : ''}>Uppercase letter</li>
                <li className={/[a-z]/.test(newPassword) ? 'ok' : ''}>Lowercase letter</li>
                <li className={/\d/.test(newPassword) ? 'ok' : ''}>Number</li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'ok' : ''}>Special character</li>
              </ul>
              {passwordError && <small id="fp-password-error" className="fp-error">{passwordError}</small>}
            </div>

            <div className="input fp-field-wrap fp-password-wrap">
              <label htmlFor="fp-confirm-password">Confirm New Password</label>
              <div className="fp-password-row">
                <input
                  id="fp-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError('');
                  }}
                  maxLength={16}
                  aria-describedby={confirmError ? 'fp-confirm-error' : undefined}
                  aria-invalid={confirmError ? 'true' : 'false'}
                />
                <button
                  type="button"
                  className="fp-eye-btn"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {confirmError && <small id="fp-confirm-error" className="fp-error">{confirmError}</small>}
            </div>
          </>
        )}
      </div>

      <div className="submit-container">
        {step === 1 ? (
          <button type="button" className="submit" onClick={handleSendOtp} disabled={loading || cooldownSeconds > 0}>
            {loading ? 'Sending...' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Send Verification Code'}
          </button>
        ) : (
          <button type="button" className="submit" onClick={handleResetPassword} disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        )}

        {step === 2 && (
          <button type="button" className="submit gray" onClick={handleSendOtp} disabled={loading || cooldownSeconds > 0}>
            {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}
          </button>
        )}

        <button type="button" className="submit gray" onClick={() => !loading && navigate('/login', { replace: true })}>
          Back to Login
        </button>
      </div>

      <div className="fp-trust">
        <p>Need help? <a href="mailto:contact@cvsu.dev">Contact support</a></p>
        <p>Security tip: We will never ask your OTP via chat or phone.</p>
      </div>
    </div>
  );
};

export default ForgotPassword;
