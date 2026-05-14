import React, { useEffect, useState } from 'react';
import { api } from '../../api';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  clearStudentHistory,
  getNotificationSettings,
  setNotificationSettings
} from './studentStorage';
import { getStoredUser } from '../../auth';

const Settings = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true
  });
  const [message, setMessage] = useState('');
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    setNotifications(getNotificationSettings());
  }, []);

  useEffect(() => {
    if (location.state?.openChangePassword) {
      setShowChangePasswordForm(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.pathname, location.state, navigate]);

  const handleNotificationChange = (key) => {
    const updated = {
      ...notifications,
      [key]: !notifications[key]
    };
    setNotifications(updated);
    setNotificationSettings(updated);
    setMessage('Notification settings saved.');
  };

  const handleClearHistory = () => {
    const confirmed = window.confirm('Clear returned and recent activity history?');
    if (!confirmed) return;
    clearStudentHistory();
    setMessage('History cleared successfully.');
  };

  const handlePasswordFieldChange = (key, value) => {
    setPasswordForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    const user = getStoredUser();
    const email = user?.email || '';

    if (!email) {
      setMessage('Unable to detect your account. Please log in again.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 16 || /\s/.test(newPassword)) {
      setMessage('Password must be 8 to 16 characters without spaces.');
      return;
    }
    const hasLetter = /[A-Za-z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    if (!hasLetter || !hasNumber) {
      setMessage('Password must contain at least one letter and one number. Special characters are allowed.');
      return;
    }

    setChangingPassword(true);
    const result = await api.changePassword(email, currentPassword, newPassword);
    setChangingPassword(false);

    if (result.success) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowChangePasswordForm(false);
    }
    setMessage(result.message || (result.success ? 'Password updated successfully.' : 'Failed to update password.'));
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>Manage your account preferences</p>
      </div>
      {message && (
        <div className="no-results" style={{ padding: '12px', marginBottom: '20px' }}>
          {message}
        </div>
      )}

      <div className="settings-section">
        <h3>Notification Preferences</h3>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Email Notifications</p>
              <p className="setting-description">Receive email updates about your borrowed books</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={notifications.email}
                onChange={() => handleNotificationChange('email')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Push Notifications</p>
              <p className="setting-description">Receive push notifications on your device</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={notifications.push}
                onChange={() => handleNotificationChange('push')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Weekly Summary</p>
              <p className="setting-description">Receive a weekly summary of your library activity</p>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={notifications.weekly}
                onChange={() => handleNotificationChange('weekly')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Account</h3>
        <div className="settings-card">
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Change Password</p>
              <p className="setting-description">Update your account password</p>
            </div>
            <button
              type="button"
              className="action-btn"
              onClick={() => setShowChangePasswordForm((prev) => !prev)}
            >
              {showChangePasswordForm ? 'Cancel' : 'Change'}
            </button>
          </div>
          {showChangePasswordForm && (
            <div className="change-password-form">
              <input
                type={showPasswords ? 'text' : 'password'}
                className="password-input"
                placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
                maxLength={16}
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                className="password-input"
                placeholder="New password"
                value={passwordForm.newPassword}
                onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
                maxLength={16}
              />
              <input
                type={showPasswords ? 'text' : 'password'}
                className="password-input"
                placeholder="Confirm new password"
                value={passwordForm.confirmPassword}
                onChange={(e) => handlePasswordFieldChange('confirmPassword', e.target.value)}
                maxLength={16}
              />
              <label className="show-password-toggle">
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) => setShowPasswords(e.target.checked)}
                />
                Show password
              </label>
              <p className="password-hint">
                Password must be 8-16 characters and include letters and numbers. Special characters are allowed.
              </p>
              <button
                type="button"
                className="action-btn"
                onClick={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? 'Updating...' : 'Save Password'}
              </button>
            </div>
          )}
          <div className="setting-item">
            <div className="setting-info">
              <p className="setting-label">Clear History</p>
              <p className="setting-description">Clear your browsing and activity history</p>
            </div>
            <button type="button" className="action-btn danger" onClick={handleClearHistory}>Clear</button>
          </div>
        </div>
      </div>

      <style>{`
        .settings-page {
          padding: 0;
        }
        .page-header {
          margin-bottom: 30px;
        }
        .page-header h2 {
          font-size: 28px;
          margin-bottom: 8px;
          color: white;
        }
        .page-header p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }
        .settings-section {
          margin-bottom: 30px;
        }
        .settings-section h3 {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 15px;
        }
        .settings-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .setting-item:last-child {
          border-bottom: none;
        }
        .setting-info {
          flex: 1;
        }
        .setting-label {
          color: white;
          font-size: 15px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .setting-description {
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
        }
        .toggle {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 26px;
          flex-shrink: 0;
        }
        .toggle input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.2);
          transition: 0.3s;
          border-radius: 26px;
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        .toggle input:checked + .toggle-slider {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .toggle input:checked + .toggle-slider:before {
          transform: translateX(24px);
        }
        .action-btn {
          padding: 8px 20px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .action-btn:hover {
          transform: scale(1.05);
        }
        .action-btn.danger {
          background: linear-gradient(135deg, #ea4335 0%, #d33426 100%);
        }
        .change-password-form {
          display: grid;
          gap: 10px;
          margin-bottom: 10px;
          padding: 10px 0 20px;
        }
        .password-input {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          color: white;
          font-size: 13px;
          padding: 10px 12px;
          outline: none;
        }
        .password-input:focus {
          border-color: rgba(118, 75, 162, 0.9);
          box-shadow: 0 0 0 2px rgba(118, 75, 162, 0.2);
        }
        .show-password-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          user-select: none;
          width: fit-content;
        }
        .show-password-toggle input {
          accent-color: #764ba2;
          cursor: pointer;
        }
        .password-hint {
          margin: 0;
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
        }
        .action-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
};

export default Settings;
