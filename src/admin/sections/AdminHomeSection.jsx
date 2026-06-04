import React from 'react';
import { formatLibraryDate } from '../../utils/libraryTime';
import AdminNavIcon from '../components/AdminNavIcon';

const AdminHomeSection = ({ admin }) => {
  const {
    dashboardInsights, circulationToday, summary, borrowRecordCounts,
    handleQuickAddBook, setActiveSection
  } = admin;

  return (
    <>
      <section className="admin-hero dashboard-home-section admin-hero-elevated" aria-labelledby="today-activity-title">
        <div className="admin-hero-top">
          <div>
            <p className="admin-hero-eyebrow">Operations overview</p>
            <h2 id="today-activity-title" className="admin-hero-title">Today&apos;s circulation</h2>
            <p className="admin-hero-subtitle admin-hero-greeting">
              {dashboardInsights.greeting}, {dashboardInsights.displayName} — {formatLibraryDate()}
            </p>
            <ul className="admin-hero-insights" aria-label="Today's summary">
              {dashboardInsights.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="admin-hero-actions">
            <button type="button" className="hero-action-btn" onClick={handleQuickAddBook}>
              <AdminNavIcon name="plus" /> Add book
            </button>
            <button type="button" className="hero-action-btn secondary" onClick={() => setActiveSection('circulation')}>
              <AdminNavIcon name="loan" /> Borrow / Return
            </button>
          </div>
        </div>
        <div className="admin-hero-metrics">
          <div className="hero-metric">
            <strong>{circulationToday.issuedToday}</strong>
            <span>Issued today</span>
            <small>New loans recorded today</small>
          </div>
          <div className="hero-metric">
            <strong>{circulationToday.returnedToday}</strong>
            <span>Returned today</span>
            <small>Completed returns today</small>
          </div>
          <div className={`hero-metric ${circulationToday.overdueCount > 0 ? 'is-alert' : 'is-healthy'}`}>
            <strong>{circulationToday.overdueCount}</strong>
            <span>Overdue alerts</span>
            <small>
              {circulationToday.overdueCount > 0
                ? 'Follow up with students today'
                : '✓ All borrowed books are on schedule'}
            </small>
          </div>
          <div className={`hero-metric ${summary.lowStock > 0 ? 'is-warning' : ''}`}>
            <strong>{summary.lowStock}</strong>
            <span>Low stock titles</span>
            <small>
              {summary.lowStock > 0
                ? '⚠ Restock recommended within 2 days'
                : 'Inventory levels look healthy'}
            </small>
          </div>
        </div>
      </section>

      <div className="summary-cards summary-cards-secondary dashboard-home-section">
        <div className="summary-card summary-card-neutral">
          <div className="card-icon"><AdminNavIcon name="books" /></div>
          <div className="card-info">
            <h3>{summary.totalTitles}</h3>
            <p>Total Titles</p>
            <span className="card-hint">Catalog size</span>
          </div>
        </div>
        <div className="summary-card summary-card-info">
          <div className="card-icon"><AdminNavIcon name="copies" /></div>
          <div className="card-info">
            <h3>{summary.totalCopies}</h3>
            <p>Total Copies</p>
            <span className="card-hint">All physical copies</span>
          </div>
        </div>
        <div className="summary-card summary-card-success">
          <div className="card-icon"><AdminNavIcon name="available" /></div>
          <div className="card-info">
            <h3>{summary.availableCopies}</h3>
            <p>Available Copies</p>
            <span className="card-hint">{summary.borrowedCopies} out on loan now</span>
          </div>
        </div>
        <div className="summary-card summary-card-danger">
          <div className="card-icon"><AdminNavIcon name="warning" /></div>
          <div className="card-info">
            <h3>{summary.lowStock}</h3>
            <p>Low Stock Titles</p>
            <span className="card-hint">Needs restocking soon</span>
          </div>
        </div>
        <div className="summary-card summary-card-warning">
          <div className="card-icon"><AdminNavIcon name="books" /></div>
          <div className="card-info">
            <h3>{borrowRecordCounts.active}</h3>
            <p>Currently Borrowed</p>
            <span className="card-hint">Active loans right now</span>
          </div>
        </div>
        <div className="summary-card summary-card-returns">
          <div className="card-icon"><AdminNavIcon name="activity" /></div>
          <div className="card-info">
            <h3>{borrowRecordCounts.returned}</h3>
            <p>All-Time Returns</p>
            <span className="card-hint">Completed returns (historical)</span>
          </div>
        </div>
      </div>
    </>

  );
};

export default AdminHomeSection;
