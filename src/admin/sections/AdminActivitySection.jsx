import React from 'react';
import AdminTableEmpty from '../components/AdminTableEmpty';

const AdminActivitySection = ({ admin }) => {
  const { activityLog, user, securityLogs, securityLogsLoading } = admin;

  return (
    <>
      <div className="content-section">
        <h3 className="section-title">Recent Admin Actions</h3>
        <div className="table-container admin-table-scroll">
          <table className="activity-table admin-activity-table admin-log-cards">
            <thead>
              <tr>
                <th className="col-admin">Admin</th>
                <th className="col-action">Action</th>
                <th className="col-details">Details</th>
                <th className="col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.length > 0 ? activityLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="col-admin" data-label="Admin">{entry.adminName || user.email || 'Admin'}</td>
                  <td className="col-action" data-label="Action">{entry.action}</td>
                  <td className="col-details" data-label="Details">{entry.details}</td>
                  <td className="col-time" data-label="Time">{entry.time}</td>
                </tr>
              )) : (
                <AdminTableEmpty
                  colSpan={4}
                  icon="📋"
                  title="No admin actions yet"
                  message="Actions you take on this device (add book, update user, etc.) will appear here."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="content-section">
        <h3 className="section-title">Security Audit Logs</h3>
        <div className="table-container admin-table-scroll">
          <table className="activity-table admin-activity-table admin-log-cards">
            <thead>
              <tr>
                <th className="col-admin">Admin</th>
                <th className="col-event">Event</th>
                <th className="col-ip">IP</th>
                <th className="col-time">Time</th>
              </tr>
            </thead>
            <tbody>
              {securityLogsLoading ? (
                <tr><td colSpan="4" className="no-results">Loading security logs...</td></tr>
              ) : securityLogs.length > 0 ? securityLogs.slice(0, 50).map((entry, idx) => (
                <tr key={`${entry.time || 'time'}-${entry.event || 'event'}-${idx}`}>
                  <td className="col-admin" data-label="Admin">{entry.admin_name || entry.adminName || 'Admin'}</td>
                  <td className="col-event" data-label="Event">{String(entry.event || '-').replace(/_/g, ' ')}</td>
                  <td className="col-ip" data-label="IP">{entry.ip || '-'}</td>
                  <td className="col-time" data-label="Time">{entry.time || '-'}</td>
                </tr>
              )) : (
                <AdminTableEmpty
                  colSpan={4}
                  icon="🔒"
                  title="No security events"
                  message="Login attempts, session changes, and other security events will show up here."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>

  );
};

export default AdminActivitySection;
