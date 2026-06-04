import React from 'react';
import AdminNavIcon from '../components/AdminNavIcon';

const AdminAnalyticsSection = ({ admin }) => {
  const { summary, borrowRecordCounts, categorySummary } = admin;

  return (
    <>
      <div className="summary-cards summary-cards-secondary analytics-kpi-grid">
        <div className="summary-card summary-card-neutral">
          <div className="card-icon"><AdminNavIcon name="books" /></div>
          <div className="card-info">
            <h3>{summary.totalTitles}</h3>
            <p>Total Titles</p>
            <span className="card-hint">In catalog</span>
          </div>
        </div>
        <div className="summary-card summary-card-info">
          <div className="card-icon"><AdminNavIcon name="copies" /></div>
          <div className="card-info">
            <h3>{summary.totalCopies}</h3>
            <p>Total Copies</p>
            <span className="card-hint">Physical inventory</span>
          </div>
        </div>
        <div className="summary-card summary-card-success">
          <div className="card-icon"><AdminNavIcon name="available" /></div>
          <div className="card-info">
            <h3>{summary.availableCopies}</h3>
            <p>Available</p>
            <span className="card-hint">{summary.borrowedCopies} on loan</span>
          </div>
        </div>
        <div className="summary-card summary-card-warning">
          <div className="card-icon"><AdminNavIcon name="loan" /></div>
          <div className="card-info">
            <h3>{borrowRecordCounts.active}</h3>
            <p>Active Loans</p>
            <span className="card-hint">Currently borrowed</span>
          </div>
        </div>
      </div>

      <div className="content-section">
        <h3 className="section-title">Category Breakdown</h3>
        <div className="table-container admin-table-scroll">
          <table className="activity-table analytics-category-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Titles</th>
              </tr>
            </thead>
            <tbody>
              {categorySummary.map(([name, count]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{count}</td>
                </tr>
              ))}
              {categorySummary.length === 0 && (
                <tr><td colSpan="2" className="no-results">No category data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>

  );
};

export default AdminAnalyticsSection;
