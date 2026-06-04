import React from 'react';
import { formatDisplayName } from '../../utils/userDisplay';

const AdminUserActionMenu = ({ admin }) => {
  const {
    userActionMenu,
    setUserActionMenu,
    user,
    userRoleSavingId,
    openUserProfile,
    requestRoleChange,
    requestPendingAdminAction
  } = admin;

  if (!userActionMenu) return null;

  const entry = userActionMenu.entry;
  const isSelf = Number(entry.id) === Number(user.id || 0);
  const isSaving = userRoleSavingId === entry.id;

  return (
    <>
      <button
        type="button"
        className="action-menu-backdrop"
        aria-label="Close actions menu"
        onClick={() => setUserActionMenu(null)}
      />
      <div
        className="action-menu-panel user-action-panel is-floating"
        style={{ top: `${userActionMenu.top}px`, left: `${userActionMenu.left}px` }}
        role="menu"
      >
        <button type="button" className="menu-action-item" role="menuitem" onClick={() => { setUserActionMenu(null); openUserProfile(entry); }}>
          View Profile
        </button>
        <button type="button" className="menu-action-item" role="menuitem" onClick={() => { setUserActionMenu(null); openUserProfile(entry); }}>
          Edit User
        </button>
        <div className="menu-action-divider" role="separator" />
        <button
          type="button"
          className="menu-action-item"
          role="menuitem"
          disabled={entry.role === 'admin' || isSaving}
          onClick={() => { setUserActionMenu(null); requestRoleChange(entry, 'admin'); }}
        >
          Promote to Admin
        </button>
        <button
          type="button"
          className="menu-action-item"
          role="menuitem"
          disabled={entry.role === 'student' || isSaving || (isSelf && entry.role === 'admin')}
          onClick={() => { setUserActionMenu(null); requestRoleChange(entry, 'student'); }}
        >
          Demote to Student
        </button>
        <div className="menu-action-divider" role="separator" />
        <button
          type="button"
          className="menu-action-item"
          role="menuitem"
          onClick={() => {
            setUserActionMenu(null);
            requestPendingAdminAction('Reset password?', `Send a password reset for ${entry.email}?`);
          }}
        >
          Reset Password
        </button>
        <button
          type="button"
          className="menu-action-item"
          role="menuitem"
          onClick={() => {
            setUserActionMenu(null);
            requestPendingAdminAction('Suspend user?', `Suspend ${formatDisplayName(entry)}? They will lose access until reactivated.`);
          }}
        >
          Suspend User
        </button>
        <button
          type="button"
          className="menu-action-item danger"
          role="menuitem"
          onClick={() => {
            setUserActionMenu(null);
            requestPendingAdminAction('Delete user?', `Permanently delete ${formatDisplayName(entry)}? This cannot be undone.`);
          }}
        >
          Delete User
        </button>
      </div>
    </>
  );
};

export default AdminUserActionMenu;
