import React from 'react';

const AdminTableEmpty = ({ colSpan = 6, icon = '📚', title, message }) => (
  <tr>
    <td colSpan={colSpan} className="admin-table-empty">
      <div className="admin-table-empty-inner">
        <span className="admin-table-empty-icon" aria-hidden="true">{icon}</span>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </td>
  </tr>
);

export default AdminTableEmpty;
