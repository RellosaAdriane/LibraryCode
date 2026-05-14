import React, { useState, useEffect } from 'react';
import { getStoredUser, updateStoredUser } from '../../auth';

const Profile = () => {
  const [user, setUser] = useState({});
  const [form, setForm] = useState({
    first_name: '',
    last_name: ''
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const userData = getStoredUser() || {};
    setUser(userData);
    setForm({
      first_name: userData.first_name || '',
      last_name: userData.last_name || ''
    });
    setLoading(false);
  }, []);

  const initials = `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`.toLowerCase() || 's';

  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    setForm({
      first_name: user.first_name || '',
      last_name: user.last_name || ''
    });
    setEditing(false);
    setMessage('');
  };

  const handleSave = () => {
    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();

    if (!firstName || !lastName) {
      setMessage('First name and last name are required.');
      return;
    }

    const updated = updateStoredUser({
      first_name: firstName,
      last_name: lastName
    });

    if (!updated) {
      setMessage('Unable to update profile. Please log in again.');
      return;
    }

    setUser(updated);
    setEditing(false);
    setMessage('Profile updated successfully.');
  };

  if (loading) {
    return <div className="no-results">Loading...</div>;
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>My Profile</h2>
        <p>View and manage your account information</p>
      </div>
      {message && (
        <div className="no-results" style={{ padding: '12px', marginBottom: '20px' }}>
          {message}
        </div>
      )}

      <div className="profile-card">
        <div className="profile-avatar">
          <span>{initials}</span>
        </div>
        <div className="profile-details">
          <div className="profile-field">
            <label>Full Name</label>
            {editing ? (
              <div className="name-row">
                <input
                  type="text"
                  className="profile-input"
                  value={form.first_name}
                  onChange={(e) => handleFormChange('first_name', e.target.value)}
                  placeholder="First name"
                />
                <input
                  type="text"
                  className="profile-input"
                  value={form.last_name}
                  onChange={(e) => handleFormChange('last_name', e.target.value)}
                  placeholder="Last name"
                />
              </div>
            ) : (
              <p>{user.first_name} {user.last_name}</p>
            )}
          </div>
          <div className="profile-field">
            <label>Email</label>
            <p>{user.email}</p>
          </div>
          <div className="profile-field">
            <label>Role</label>
            <p>{user.role || 'Student'}</p>
          </div>
          <div className="profile-field">
            <label>Student ID</label>
            <p>{user.id || 'N/A'}</p>
          </div>
          <div className="profile-actions">
            {editing ? (
              <>
                <button type="button" className="action-btn" onClick={handleSave}>Save Profile</button>
                <button type="button" className="action-btn secondary" onClick={handleCancel}>Cancel</button>
              </>
            ) : (
              <button type="button" className="action-btn" onClick={() => setEditing(true)}>Edit Profile</button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .profile-page {
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
        .profile-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 40px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 40px;
          align-items: flex-start;
        }
        .profile-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 42px;
          font-weight: 600;
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
          flex-shrink: 0;
        }
        .profile-details {
          flex: 1;
          display: grid;
          gap: 20px;
        }
        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .profile-field label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .profile-field p {
          color: white;
          font-size: 16px;
          font-weight: 500;
        }
        .name-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .profile-input {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.06);
          color: white;
          font-size: 14px;
          padding: 10px 12px;
          outline: none;
        }
        .profile-input:focus {
          border-color: rgba(118, 75, 162, 0.9);
          box-shadow: 0 0 0 2px rgba(118, 75, 162, 0.2);
        }
        .profile-actions {
          display: flex;
          gap: 10px;
          padding-top: 8px;
        }
        .action-btn {
          padding: 10px 16px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .action-btn.secondary {
          background: rgba(255, 255, 255, 0.15);
        }
        @media (max-width: 768px) {
          .profile-card {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          .name-row {
            grid-template-columns: 1fr;
          }
          .profile-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default Profile;
