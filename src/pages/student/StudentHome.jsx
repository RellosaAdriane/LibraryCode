import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { getStoredUser } from '../../auth';
import {
  getBooksData,
  getBorrowedData,
  getReturnedData,
  getPenaltySummary,
  getPenaltyPolicy,
  setPenaltyPolicy
} from './studentStorage';

const StatIcon = ({ children }) => (
  <svg
    className="card-icon-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const statIcons = {
  totalBooks: (
    <StatIcon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
      <path d="M4 5.5A2.5 2.5 0 0 0 6.5 8H20" />
      <path d="M8 12h8" />
      <path d="M8 15h6" />
    </StatIcon>
  ),
  borrowed: (
    <StatIcon>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="M9 7h6" />
      <path d="M9 10h5" />
      <path d="m10 16 3 3 3-3" />
      <path d="M13 13v6" />
    </StatIcon>
  ),
  returned: (
    <StatIcon>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="M9 7h6" />
      <path d="M9 10h5" />
      <path d="m16 16-3 3-3-3" />
      <path d="M13 19v-6" />
    </StatIcon>
  ),
  overdue: (
    <StatIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M7 4.5 4.5 7" />
      <path d="m17 4.5 2.5 2.5" />
    </StatIcon>
  ),
  availableCopies: (
    <StatIcon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M8 7h7" />
      <path d="M8 10h5" />
      <path d="m15 16 2 2 4-4" />
    </StatIcon>
  ),
  categories: (
    <StatIcon>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-9Z" />
      <path d="M8 11h8" />
      <path d="M8 14h5" />
    </StatIcon>
  ),
  openHours: (
    <StatIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
      <path d="M7 3.5 4.5 6" />
      <path d="m17 3.5 2.5 2.5" />
    </StatIcon>
  )
};

const StudentHome = () => {
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcement, setAnnouncement] = useState(null);
  const [summaryData, setSummaryData] = useState({
    totalBooks: 0,
    borrowed: 0,
    returned: 0,
    overdue: 0,
    availableCopies: 0,
    categories: 0,
    penaltyDue: 0,
    maxOverdueDays: 0,
    canBorrow: true
  });
  const [penaltyPolicy, setPenaltyPolicyState] = useState(getPenaltyPolicy());
  const [recommendedBooks, setRecommendedBooks] = useState([]);
  const isGuest = !user?.email;

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return 'Not available';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return String(dateValue);
    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const resolveCoverPath = (cover) => {
    if (!cover) return '/book-covers/javascript-good-parts.svg';
    if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;
    if (cover.startsWith('/')) return cover;
    return `/book-covers/${cover}`;
  };

  const loadAnnouncementSettings = useCallback(async () => {
    try {
      setAnnouncementLoading(true);
      const result = await api.getAnnouncementSettings();
      if (result.success && result.settings) {
        setAnnouncement({
          enabled: Boolean(result.settings.enabled),
          title: result.settings.title || 'Library Notice',
          message: result.settings.message || '',
          updatedAt: result.settings.updated_at || null
        });
      } else {
        setAnnouncement(null);
      }
    } catch (error) {
      setAnnouncement(null);
    } finally {
      setAnnouncementLoading(false);
    }
  }, []);

  const updateDerivedSections = (books, borrowed, returned, apiSummary = null, policyOverride = null) => {
    const borrowedBookIds = new Set(borrowed.map((item) => item.bookId));
    const recommended = books
      .filter((book) => book.available > 0 && !borrowedBookIds.has(book.id))
      .slice(0, 3);

    const availableCopies = books.reduce((total, book) => total + (Number(book.available) || 0), 0);
    const categories = new Set(books.map((book) => book.category).filter(Boolean)).size;
    const overdue = borrowed.filter((item) => item.status === 'overdue').length;
    const penaltySummary = getPenaltySummary(borrowed, policyOverride || penaltyPolicy);

    setSummaryData({
      totalBooks: apiSummary?.totalBooks ?? books.length,
      borrowed: borrowed.length,
      returned: returned.length,
      overdue,
      availableCopies,
      categories,
      penaltyDue: apiSummary?.penaltyDue ?? penaltySummary.penaltyDue,
      maxOverdueDays: apiSummary?.maxOverdueDays ?? penaltySummary.maxOverdueDays,
      canBorrow: apiSummary?.canBorrow ?? !penaltySummary.blocked
    });
    setRecommendedBooks(recommended);
  };

  const loadPenaltySettings = useCallback(async () => {
    try {
      const result = await api.getPenaltySettings();
      if (result.success && result.settings) {
        setPenaltyPolicy(result.settings);
        const nextPolicy = {
          graceDays: Number(result.settings.grace_days ?? 7),
          dailyFee: Number(result.settings.daily_fee ?? 150),
          blockOverdueDays: Number(result.settings.block_overdue_days ?? 14)
        };
        setPenaltyPolicyState(nextPolicy);
        const localBooks = getBooksData();
        const localBorrowed = getBorrowedData();
        const localReturned = getReturnedData();
        updateDerivedSections(localBooks, localBorrowed, localReturned, null, nextPolicy);
      }
    } catch (error) {
      // Ignore policy load failures and fallback to defaults.
    }
  }, []);

  useEffect(() => {
    const userData = getStoredUser() || {};
    setUser(userData);

    if (userData.email) {
      fetchStudentData(userData.email);
      return;
    }

    loadPenaltySettings();

    const localBooks = getBooksData();
    const localBorrowed = getBorrowedData();
    const localReturned = getReturnedData();
    updateDerivedSections(localBooks, localBorrowed, localReturned);
    setLoading(false);
  }, [loadPenaltySettings]);

  useEffect(() => {
    loadAnnouncementSettings();
  }, [loadAnnouncementSettings]);

  const fetchStudentData = async (email) => {
    const localBooks = getBooksData();
    const localBorrowed = getBorrowedData();
    const localReturned = getReturnedData();

    try {
      setLoading(true);
      const [summaryResult, penaltyResult] = await Promise.all([
        api.getStudentSummary(),
        api.getPenaltySettings()
      ]);
      const apiSummary = summaryResult.success ? summaryResult.data : null;

      if (penaltyResult.success && penaltyResult.settings) {
        setPenaltyPolicy(penaltyResult.settings);
        const nextPolicy = {
          graceDays: Number(penaltyResult.settings.grace_days ?? 7),
          dailyFee: Number(penaltyResult.settings.daily_fee ?? 150),
          blockOverdueDays: Number(penaltyResult.settings.block_overdue_days ?? 14)
        };
        setPenaltyPolicyState(nextPolicy);
        updateDerivedSections(localBooks, localBorrowed, localReturned, apiSummary, nextPolicy);
        setLoading(false);
        return;
      }

      updateDerivedSections(localBooks, localBorrowed, localReturned, apiSummary);

      if (!summaryResult.success) {
        console.error('Summary error:', summaryResult.message);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      updateDerivedSections(localBooks, localBorrowed, localReturned);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="student-home">
      <div className="welcome-card">
        <div className="welcome-info">
          {isGuest ? (
            <>
              <h2>Welcome to the Library Dashboard!</h2>
              <p>Browse available books as a guest and explore what is in the catalog today.</p>
              <p className="hero-meta">Open 8:00 AM to 7:00 PM | Monday to Friday</p>
              <p className="user-email">Login or create an account to borrow, renew, and track due dates.</p>
              <div className="welcome-actions">
                <Link to="/student-dashboard/books" className="action-btn">Browse Books</Link>
                <Link to="/login" className="action-btn secondary-btn">Login / Create Account</Link>
              </div>
              <div className="hero-quick-links">
                <a href="#how-to-borrow">How Borrowing Works</a>
                <a href="#rules-help">Library Rules</a>
              </div>
            </>
          ) : (
            <>
              <h2>Welcome back, {user.first_name} {user.last_name}!</h2>
              <p>Review your current borrowing status and complete pending returns on time.</p>
              <p className="hero-meta">Open 8:00 AM to 7:00 PM | Monday to Friday</p>
              <p className="user-email">{user.email}</p>
              <div className="welcome-actions">
                <Link to="/student-dashboard/books" className="action-btn">Browse Books</Link>
                <Link to="/student-dashboard/borrowed" className="action-btn secondary-btn">View Borrowed</Link>
              </div>
              <div className="hero-quick-links">
                <a href="#how-to-borrow">How Borrowing Works</a>
                <a href="#rules-help">Library Rules</a>
              </div>
            </>
          )}
        </div>
        <div className="welcome-avatar">
          <span>{isGuest ? 'Guest' : `${user.first_name?.charAt(0) || ''}${user.last_name?.charAt(0) || ''}`}</span>
        </div>
      </div>

      {loading ? (
        <div className="summary-cards loading-cards">
          {[1, 2, 3, 4].map((item) => (
            <div className="summary-card skeleton-card" key={item}>
              <div className="card-icon skeleton-block" />
              <div className="card-info">
                <h3 className="skeleton-text short" />
                <p className="skeleton-text long" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="summary-cards" aria-label="Dashboard summary">
          <div className="summary-card">
            <div className="card-icon" aria-hidden="true">{statIcons.totalBooks}</div>
            <div className="card-info">
              <h3>{summaryData.totalBooks}</h3>
              <p>Total Books</p>
            </div>
          </div>

          {isGuest ? (
            <>
              <div className="summary-card borrowed">
                <div className="card-icon" aria-hidden="true">{statIcons.availableCopies}</div>
                <div className="card-info">
                  <h3>{summaryData.availableCopies}</h3>
                  <p>Available Copies</p>
                </div>
              </div>
              <div className="summary-card returned">
                <div className="card-icon" aria-hidden="true">{statIcons.categories}</div>
                <div className="card-info">
                  <h3>{summaryData.categories}</h3>
                  <p>Categories</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="card-icon" aria-hidden="true">{statIcons.openHours}</div>
                <div className="card-info">
                  <h3>8-7</h3>
                  <p>Open Hours</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="summary-card borrowed">
                <div className="card-icon" aria-hidden="true">{statIcons.borrowed}</div>
                <div className="card-info">
                  <h3>{summaryData.borrowed}</h3>
                  <p>Borrowed</p>
                </div>
              </div>
              <div className="summary-card returned">
                <div className="card-icon" aria-hidden="true">{statIcons.returned}</div>
                <div className="card-info">
                  <h3>{summaryData.returned}</h3>
                  <p>Returned</p>
                </div>
              </div>
              <div className="summary-card overdue">
                <div className="card-icon" aria-hidden="true">{statIcons.overdue}</div>
                <div className="card-info">
                  <h3>{summaryData.overdue}</h3>
                  <p>Overdue</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!loading && !isGuest && (summaryData.penaltyDue > 0 || !summaryData.canBorrow || summaryData.maxOverdueDays > 0) && (
        <div className="content-section" id="penalty-alert">
          <h3 className="section-title">Penalty Notice</h3>
          <div className="guide-list">
            <p><strong>Current late fees:</strong> PHP {summaryData.penaltyDue}</p>
            {summaryData.canBorrow ? (
              <p><strong>Status:</strong> You can still borrow books during the grace period.</p>
            ) : (
              <p><strong>Status:</strong> Borrowing is blocked until overdue items are returned.</p>
            )}
          </div>
        </div>
      )}

      <div className="dashboard-insights-grid">
        <div className="content-section" id="how-to-borrow">
          <h3 className="section-title">How to Borrow</h3>
          <div className="guide-list">
            <p><strong>1.</strong> Browse the catalog and choose an available title.</p>
            <p><strong>2.</strong> Click borrow and confirm your request.</p>
            <p><strong>3.</strong> Track due dates in the borrowed page.</p>
            <p><strong>4.</strong> Return books within the {penaltyPolicy.graceDays}-day grace period to avoid penalties.</p>
          </div>
        </div>

        <div className="content-section" id="rules-help">
          <h3 className="section-title">Library Rules and Help</h3>
          <div className="guide-list">
            <p><strong>Borrowing Limit:</strong> Up to 3 books per student account.</p>
            <p><strong>Borrowing Period:</strong> 14 days per title.</p>
            <p><strong>Late Fees:</strong> After {penaltyPolicy.graceDays} days overdue, PHP {penaltyPolicy.dailyFee} per day.</p>
            <p><strong>Borrowing Block:</strong> Applied after {penaltyPolicy.blockOverdueDays} overdue days.</p>
            <p><strong>Contact:</strong> library.help@campus.edu</p>
            <p><strong>Hours:</strong> Monday to Friday, 8:00 AM to 7:00 PM.</p>
          </div>
        </div>
      </div>

      <div className="content-section">
        <h3 className="section-title">Recommended Books</h3>
        {recommendedBooks.length > 0 ? (
          <div className="recommendations-grid">
            {recommendedBooks.map((book) => (
              <article key={book.id} className="recommendation-card">
                <img
                  src={resolveCoverPath(book.cover)}
                  alt={`${book.title} cover`}
                  className="recommendation-cover"
                />
                <div className="recommendation-content">
                  <strong>{book.title}</strong>
                  <p>{book.author}</p>
                  <div className="recommendation-meta">
                    <span className="availability-badge available">{book.available} copies available</span>
                    <span className="recommendation-category">{book.category}</span>
                  </div>
                </div>
                <Link to="/student-dashboard/books" className="action-btn small-btn">View Details</Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">No recommendations at the moment.</p>
        )}
      </div>

      <div className="content-section">
        <h3 className="section-title">Announcements</h3>
        {announcementLoading ? (
          <p className="empty-message">Loading announcement...</p>
        ) : announcement?.enabled && announcement?.message ? (
          <div className="announcements-grid">
            <div className="announcement-card">
              <div className="announcement-header">
                <h4>{announcement.title || 'Library Notice'}</h4>
                <span className="announcement-date">
                  {announcement.updatedAt ? formatDisplayDate(announcement.updatedAt) : 'Recently updated'}
                </span>
              </div>
              <p>{announcement.message}</p>
            </div>
          </div>
        ) : (
          <p className="empty-message">No announcement is currently posted.</p>
        )}
      </div>

      <footer className="landing-footer">
        <p><strong>Phone Number:</strong> +63 9157727986</p>
        <p><strong>Facebook:</strong> fb.com/campuslibrary</p>
        <p><strong>Librarian Contact:</strong> library.help@campus.edu</p>
      </footer>
    </div>
  );
};

export default StudentHome;
