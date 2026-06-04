import React from 'react';

const AdminConfirmDialog = ({ admin }) => {
  const { confirmDialog, setConfirmDialog } = admin;

  if (!confirmDialog) return null;

  return (
    <div className="confirm-modal-overlay" role="presentation" onClick={() => setConfirmDialog(null)}>
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h4 id="confirm-dialog-title">{confirmDialog.title}</h4>
        <p>{confirmDialog.message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="table-btn" onClick={() => setConfirmDialog(null)}>Cancel</button>
          <button
            type="button"
            className="table-btn danger"
            onClick={() => confirmDialog.onConfirm?.()}
          >
            {confirmDialog.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminConfirmDialog;
