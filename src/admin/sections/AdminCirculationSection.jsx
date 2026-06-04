import React from 'react';
import { formatBorrowStudentName } from '../../utils/userDisplay';
import AdminNavIcon from '../components/AdminNavIcon';
import SectionTitle from '../components/SectionTitle';
import AdminTableEmpty from '../components/AdminTableEmpty';
import { getBorrowTableContainerClass } from '../utils/borrowHelpers';
import PenaltyCell from '../components/PenaltyCell';
import { getBookAvailable } from '../utils/bookHelpers';

const AdminCirculationSection = ({ admin }) => {
  const {
    circulationToday, summary, borrowRecordCounts, recentActivity, recentActivityLoading,
    recentActivityError, loadRecentActivity, filteredActiveBorrows, filteredReturnedBooks,
    activeBorrowSearch, setActiveBorrowSearch, returnedBookSearch, setReturnedBookSearch,
    borrowRecordsLoading, lowStockBooks, handleRestock
  } = admin;

  return (
    <>
      <section className="circulation-stats dashboard-home-section" aria-label="Circulation summary">
        <div className="circulation-stat-cards">
          <article className="circulation-stat-card">
            <strong>{circulationToday.issuedToday}</strong>
            <span>Borrowed today</span>
            <small>New loans recorded today</small>
          </article>
          <article className={`circulation-stat-card ${circulationToday.overdueCount > 0 ? 'is-alert' : ''}`}>
            <strong>{circulationToday.overdueCount}</strong>
            <span>Overdue books</span>
            <small>{circulationToday.overdueCount > 0 ? 'Needs follow-up' : 'All loans on schedule'}</small>
          </article>
          <article className="circulation-stat-card">
            <strong>{borrowRecordCounts.active}</strong>
            <span>Active borrowers</span>
            <small>Currently out on loan</small>
          </article>
          <article className="circulation-stat-card">
            <strong>{circulationToday.returnedToday}</strong>
            <span>Returned today</span>
            <small>Completed returns today</small>
          </article>
          <article className={`circulation-stat-card ${summary.lowStock > 0 ? 'is-warning' : ''}`}>
            <strong>{summary.lowStock}</strong>
            <span>Low stock alerts</span>
            <small>{summary.lowStock > 0 ? 'Titles need restocking' : 'Inventory healthy'}</small>
          </article>
        </div>
      </section>

      <div className="circulation-top-grid dashboard-home-section">
        <section className="circulation-activity-panel admin-surface-card" aria-label="Recent activity">
          <div className="circulation-activity-header">
            <h3 className="circulation-section-heading">Recent activity</h3>
            <button
              type="button"
              className="circulation-activity-refresh"
              onClick={loadRecentActivity}
              disabled={recentActivityLoading}
            >
              {recentActivityLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {recentActivityLoading && recentActivity.length === 0 ? (
            <ul className="circulation-skeleton-list" aria-hidden="true">
              {[1, 2, 3, 4].map((slot) => (
                <li key={slot} className="circulation-skeleton-row" />
              ))}
            </ul>
          ) : recentActivityError ? (
            <p className="circulation-activity-status is-error">{recentActivityError}</p>
          ) : recentActivity.length === 0 ? (
            <p className="circulation-activity-status">No circulation activity yet.</p>
          ) : (
            <ul className="admin-activity-timeline circulation-activity-feed">
              {recentActivity.map((item) => (
                <li key={item.id} className={`admin-activity-card ${item.type}`}>
                  <span className={`activity-dot activity-dot-${item.type}`} aria-hidden="true" />
                  <div className="activity-card-body">
                    <p className="activity-card-headline">
                      <strong>{item.studentName}</strong> <span className="activity-card-action">{item.action}</span>
                    </p>
                    <p className="activity-card-book" title={item.title}>&ldquo;{item.title}&rdquo;</p>
                    <time className="activity-card-time">{item.timeAgo}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="circulation-quick-panel admin-surface-card" aria-label="Quick overview">
          <h3 className="circulation-section-heading">At a glance</h3>
          <ul className="circulation-quick-list">
            <li>
              <span className="circulation-quick-label">Due today</span>
              <strong className={circulationToday.dueTodayCount > 0 ? 'is-highlight' : ''}>
                {circulationToday.dueTodayCount}
              </strong>
            </li>
            <li>
              <span className="circulation-quick-label">Active loans</span>
              <strong>{borrowRecordCounts.active}</strong>
            </li>
            <li>
              <span className="circulation-quick-label">Overdue</span>
              <strong className={circulationToday.overdueCount > 0 ? 'is-alert-text' : ''}>
                {circulationToday.overdueCount}
              </strong>
            </li>
            <li>
              <span className="circulation-quick-label">Low stock</span>
              <strong className={summary.lowStock > 0 ? 'is-warning-text' : ''}>{summary.lowStock}</strong>
            </li>
          </ul>
          <div className="circulation-status-legend" aria-label="Status legend">
            <span><i className="legend-dot legend-dot-borrow" aria-hidden="true" /> Borrowed</span>
            <span><i className="legend-dot legend-dot-return" aria-hidden="true" /> Returned</span>
            <span><i className="legend-dot legend-dot-overdue" aria-hidden="true" /> Overdue</span>
          </div>
        </aside>
      </div>

      <div className="admin-borrow-panels dashboard-home-section admin-primary-grid">
        <div className="admin-borrow-panel admin-surface-card" id="active-borrows-section">
          <div className="section-heading-row">
            <SectionTitle icon="loan">Currently borrowed books</SectionTitle>
            <div className="section-heading-meta">
              <span className="admin-borrow-count">{borrowRecordCounts.active} active</span>
              <span className="admin-result-shown">{filteredActiveBorrows.length} shown</span>
            </div>
          </div>
          <div className="admin-table-toolbar">
            <input
              type="search"
              className="admin-table-search"
              placeholder="Search student or book..."
              value={activeBorrowSearch}
              onChange={(event) => setActiveBorrowSearch(event.target.value)}
              aria-label="Search active borrows"
            />
          </div>
          <div className={getBorrowTableContainerClass(filteredActiveBorrows.length, borrowRecordsLoading)}>
            <table className="activity-table admin-borrow-table">
              <thead>
                <tr>
                  <th className="col-student">Student</th>
                  <th className="col-book">Book</th>
                  <th className="col-date">Due</th>
                  <th className="col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {borrowRecordsLoading ? (
                  <>
                    {[1, 2, 3, 4].map((slot) => (
                      <tr key={slot} className="table-skeleton-row" aria-hidden="true">
                        <td colSpan={4}><span className="table-skeleton-bar" /></td>
                      </tr>
                    ))}
                  </>
                ) : filteredActiveBorrows.length > 0 ? (
                  filteredActiveBorrows.map((record) => (
                    <tr key={record.id}>
                      <td className="cell-student" title={formatBorrowStudentName(record.studentName)}>
                        <span className="table-cell-clamp">{formatBorrowStudentName(record.studentName)}</span>
                      </td>
                      <td className="cell-book" title={record.title}>
                        <span className="table-cell-clamp">{record.title}</span>
                      </td>
                      <td className="cell-date">{record.dueDate || '-'}</td>
                      <td className="cell-status">
                        <span className={`borrow-status ${record.status}`}>
                          {record.status === 'overdue' ? 'Overdue' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <AdminTableEmpty
                    icon="📖"
                    title={activeBorrowSearch ? 'No matching borrows' : 'No active borrows'}
                    message={activeBorrowSearch
                      ? 'Try a different search term or clear the filter.'
                      : 'No students currently have borrowed books. New loans will appear here.'}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-borrow-panel admin-surface-card" id="returns-section">
          <div className="section-heading-row">
            <SectionTitle icon="returnBook">Recently returned books</SectionTitle>
            <div className="section-heading-meta">
              <span className="admin-borrow-count">{borrowRecordCounts.returned} all-time</span>
              <span className="admin-result-shown">{filteredReturnedBooks.length} shown</span>
            </div>
          </div>
          <div className="admin-table-toolbar">
            <input
              type="search"
              className="admin-table-search"
              placeholder="Search student or book..."
              value={returnedBookSearch}
              onChange={(event) => setReturnedBookSearch(event.target.value)}
              aria-label="Search returned books"
            />
          </div>
          <div className={getBorrowTableContainerClass(filteredReturnedBooks.length, borrowRecordsLoading)}>
            <table className="activity-table admin-borrow-table">
              <thead>
                <tr>
                  <th className="col-student">Student</th>
                  <th className="col-book">Book</th>
                  <th className="col-date">Returned</th>
                  <th className="col-status">Penalty</th>
                </tr>
              </thead>
              <tbody>
                {borrowRecordsLoading ? (
                  <>
                    {[1, 2, 3, 4].map((slot) => (
                      <tr key={slot} className="table-skeleton-row" aria-hidden="true">
                        <td colSpan={4}><span className="table-skeleton-bar" /></td>
                      </tr>
                    ))}
                  </>
                ) : filteredReturnedBooks.length > 0 ? (
                  filteredReturnedBooks.map((record) => (
                    <tr key={record.id}>
                      <td className="cell-student" title={formatBorrowStudentName(record.studentName)}>
                        <span className="table-cell-clamp">{formatBorrowStudentName(record.studentName)}</span>
                      </td>
                      <td className="cell-book" title={record.title}>
                        <span className="table-cell-clamp">{record.title}</span>
                      </td>
                      <td className="cell-date">{record.returnDate || '-'}</td>
                      <td className="cell-status">{<PenaltyCell record={record} />}</td>
                    </tr>
                  ))
                ) : (
                  <AdminTableEmpty
                    icon="✅"
                    title={returnedBookSearch ? 'No matching returns' : 'No returns yet'}
                    message={returnedBookSearch
                      ? 'Try a different search term or clear the filter.'
                      : 'Completed book returns will appear here once students return items.'}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-borrow-panel admin-surface-card low-stock-section dashboard-home-section" id="low-stock-section">
        <div className="section-heading-row">
          <SectionTitle icon="warning">Low stock books</SectionTitle>
          <span className="admin-borrow-count is-warning">{summary.lowStock} need attention</span>
        </div>
        <div className={getBorrowTableContainerClass(lowStockBooks.length, false)}>
          <table className="activity-table admin-borrow-table">
            <thead>
              <tr>
                <th className="col-book">Title</th>
                <th className="col-date">Category</th>
                <th className="col-status">Available</th>
                <th className="col-status">Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStockBooks.slice(0, 6).map((book) => (
                <tr key={book.id} className="low-stock-row">
                  <td className="cell-book" title={book.title}>
                    <span className="table-cell-clamp">{book.title}</span>
                  </td>
                  <td className="cell-truncate">{book.category || '-'}</td>
                  <td className="cell-date">{getBookAvailable(book)}</td>
                  <td>
                    <button type="button" className="table-action-btn table-action-btn-warning" onClick={() => handleRestock(book)}>
                      <AdminNavIcon name="warning" /> Restock soon
                    </button>
                  </td>
                </tr>
              ))}
              {lowStockBooks.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  icon="✨"
                  title="Inventory looks healthy"
                  message="No low stock titles right now. Books with limited copies will show here."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>

  );
};

export default AdminCirculationSection;
