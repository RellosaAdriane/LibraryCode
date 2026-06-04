import React from 'react';
import { formatDisplayName, getUserInitials } from '../../utils/userDisplay';
import UserRoleIcon from './UserRoleIcon';
import { getRoleBadgeClass, getRoleLabel } from '../utils/userRoleHelpers';

const AdminUserProfileModal = ({ admin }) => {
  const {
    selectedUserProfile,
    setSelectedUserProfile,
    profileTab,
    setProfileTab,
    profileSessions,
    profileSessionsLoading,
    profileBorrows,
    profileBorrowsLoading,
    profileAdminNotes,
    saveProfileAdminNote,
    formatUserDate,
    profileUserActivity,
    user,
    requestRoleChange
  } = admin;

  if (!selectedUserProfile) return null;

  return (
    <div className="confirm-modal-overlay profile-overlay" role="presentation" onClick={() => setSelectedUserProfile(null)}>
      <div
        className="user-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="user-profile-header">
          <div className="user-profile-identity">
            <span className={`user-avatar large ${getRoleBadgeClass(selectedUserProfile)}`}>
              {getUserInitials(selectedUserProfile)}
            </span>
            <div>
              <h4 id="user-profile-title">{formatDisplayName(selectedUserProfile)}</h4>
              <p>{selectedUserProfile.email}</p>
              <span className={`role-pill ${getRoleBadgeClass(selectedUserProfile)}`}>
                <UserRoleIcon role={selectedUserProfile.role} affiliation={selectedUserProfile.affiliation} />
                {getRoleLabel(selectedUserProfile)}
              </span>
            </div>
          </div>
          <button type="button" className="profile-close-btn" onClick={() => setSelectedUserProfile(null)} aria-label="Close profile">
            ×
          </button>
        </div>

        <div className="profile-tabs" role="tablist" aria-label="User profile sections">
          <button type="button" role="tab" className={profileTab === 'overview' ? 'active' : ''} onClick={() => setProfileTab('overview')}>Overview</button>
          <button type="button" role="tab" className={profileTab === 'borrowing' ? 'active' : ''} onClick={() => setProfileTab('borrowing')}>Borrowing</button>
          <button type="button" role="tab" className={profileTab === 'activity' ? 'active' : ''} onClick={() => setProfileTab('activity')}>Activity</button>
        </div>

        {profileTab === 'overview' && (
          <>
            <div className="user-profile-grid">
              <div className="profile-field">
                <span>Affiliation</span>
                <strong>{selectedUserProfile.affiliation || '-'}</strong>
              </div>
              <div className="profile-field">
                <span>Institution ID</span>
                <strong>{selectedUserProfile.institution_id || '-'}</strong>
              </div>
              <div className="profile-field">
                <span>Joined</span>
                <strong>{formatUserDate(selectedUserProfile.created_at)}</strong>
              </div>
              <div className="profile-field">
                <span>Account Status</span>
                <strong className="status-active">Active</strong>
              </div>
            </div>

            <div className="user-profile-section">
              <h5>Admin Notes</h5>
              <textarea
                className="profile-notes-input"
                rows={3}
                placeholder="Internal notes visible only to admins..."
                value={profileAdminNotes[selectedUserProfile.id] || ''}
                onChange={(event) => saveProfileAdminNote(selectedUserProfile.id, event.target.value)}
              />
            </div>

            <div className="user-profile-section">
              <h5>Recent Sessions</h5>
              {profileSessionsLoading ? (
                <p className="profile-muted">Loading sessions...</p>
              ) : profileSessions.length > 0 ? (
                <ul className="profile-session-list">
                  {profileSessions.slice(0, 4).map((session) => (
                    <li key={session.id}>
                      <span>{String(session.user_agent || 'Unknown device').slice(0, 64)}</span>
                      <small>
                        {session.revoked_at ? 'Revoked' : 'Active'}
                        {' · '}
                        {formatUserDate(session.last_seen_at || session.created_at)}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="profile-muted">No session history available.</p>
              )}
            </div>
          </>
        )}

        {profileTab === 'borrowing' && (
          <div className="user-profile-section">
            <h5>Borrowing History</h5>
            {profileBorrowsLoading ? (
              <p className="profile-muted">Loading borrowing records...</p>
            ) : profileBorrows.length > 0 ? (
              <ul className="profile-borrow-list">
                {profileBorrows.map((borrow) => (
                  <li key={borrow.id}>
                    <div className="borrow-row-top">
                      <strong>{borrow.title}</strong>
                      <span className={`borrow-status ${borrow.status}`}>{borrow.status}</span>
                    </div>
                    <small>
                      Borrowed {borrow.borrowDate || '-'}
                      {borrow.dueDate ? ` · Due ${borrow.dueDate}` : ''}
                      {borrow.returnDate ? ` · Returned ${borrow.returnDate}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-muted">No borrowing records found for this user.</p>
            )}
          </div>
        )}

        {profileTab === 'activity' && (
          <div className="user-profile-section">
            <h5>Admin Activity Timeline</h5>
            {profileUserActivity.length > 0 ? (
              <ul className="profile-activity-list">
                {profileUserActivity.map((entry, index) => (
                  <li key={`${entry.timestamp || entry.time}-${index}`}>
                    <span className="activity-chip">{entry.event || 'update'}</span>
                    <p>{entry.admin_name || 'Admin'} updated this account</p>
                    <small>{entry.time || '-'}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="profile-muted">No admin activity logged for this user yet.</p>
            )}
          </div>
        )}

        <div className="user-profile-actions">
          <button
            type="button"
            className="table-btn"
            onClick={() => {
              const target = selectedUserProfile;
              setSelectedUserProfile(null);
              requestRoleChange(target, target.role === 'admin' ? 'student' : 'admin');
            }}
            disabled={Number(selectedUserProfile.id) === Number(user.id || 0) && selectedUserProfile.role === 'admin'}
          >
            {selectedUserProfile.role === 'admin' ? 'Demote to Student' : 'Promote to Admin'}
          </button>
          <button type="button" className="table-btn" onClick={() => setSelectedUserProfile(null)}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfileModal;
