import React from 'react';
import AdminTableEmpty from '../components/AdminTableEmpty';

const AdminStudentLogsSection = ({ admin }) => {
  const { studentActivityLog } = admin;

  return (
    <div className="content-section">
      <h3 className="section-title">Recent Student Activity</h3>
      <div className="table-container admin-table-scroll">
        <table className="activity-table admin-activity-table student-activity-table admin-log-cards">
          <thead>
            <tr>
              <th className="col-student">Student</th>
              <th className="col-action">Action</th>
              <th className="col-details">Details</th>
              <th className="col-time">Time</th>
            </tr>
          </thead>
          <tbody>
            {studentActivityLog.length > 0 ? studentActivityLog.map((entry) => (
              <tr key={entry.id}>
                <td className="col-student" data-label="Student" title={entry.user}>{entry.user}</td>
                <td className="col-action" data-label="Action">{entry.action}</td>
                <td className="col-details" data-label="Details">{entry.details}</td>
                <td className="col-time" data-label="Time">{entry.time}</td>
              </tr>
            )) : (
              <AdminTableEmpty
                colSpan={4}
                icon="🎓"
                title="No student activity yet"
                message="Borrow, return, and overdue events from students will appear in this log."
              />
            )}
          </tbody>
        </table>
      </div>
    </div>

  );
};

export default AdminStudentLogsSection;
