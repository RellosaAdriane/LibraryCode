import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { getStoredUser, isAuthenticated } from '../../auth';
import { useLibraryDataRefresh } from '../../hooks/useLibraryDataRefresh';
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
    </StatIcon>
  ),
  borrowed: (
    <StatIcon>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="m10 16 3 3 3-3" />
      <path d="M13 13v6" />
    </StatIcon>
  ),
  returned: (
    <StatIcon>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
      <path d="m16 16-3 3-3-3" />
      <path d="M13 19v-6" />
    </StatIcon>
  ),
  overdue: (
    <StatIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </StatIcon>
  ),
  availableCopies: (
    <StatIcon>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="m15 16 2 2 4-4" />
    </StatIcon>
  ),
  categories: (
    <StatIcon>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v7A2.5 2.5 0 0 1 17.5 18h-11A2.5 2.5 0 0 1 4 15.5v-9Z" />
    </StatIcon>
  ),
  openHours: (
    <StatIcon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </StatIcon>
  )
};

const getCategoryTone = (category) => {
  const value = String(category || '').toLowerCase();
  if (value.includes('computer')) return 'cat-computer';
  if (value.includes('information')) return 'cat-information';
  if (value.includes('science')) return 'cat-science';
  return 'cat-default';
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
  const isGuest = !isAuthenticated();

  const formatDisplayDate = (dateValue) => {
    if (!dateValue) return '';
    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) return String(dateValue);
    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
      .slice(0, 5);

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

  const fetchStudentData = useCallback(async () => {
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
        return;
      }

      updateDerivedSections(localBooks, localBorrowed, localReturned, apiSummary);
    } catch (err) {
      console.error('Fetch error:', err);
      updateDerivedSections(localBooks, localBorrowed, localReturned);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshHomeData = useCallback(async () => {
    await loadAnnouncementSettings();
    if (isAuthenticated()) {
      await fetchStudentData();
      return;
    }

    await loadPenaltySettings();
    updateDerivedSections(getBooksData(), getBorrowedData(), getReturnedData());
  }, [fetchStudentData, loadAnnouncementSettings, loadPenaltySettings]);

  useLibraryDataRefresh(refreshHomeData);

  useEffect(() => {
    const loadCurrentUser = () => {
      const userData = getStoredUser() || {};
      setUser(userData);

      if (userData.email && isAuthenticated()) {
        fetchStudentData();
        return;
      }

      loadPenaltySettings();

      const localBooks = getBooksData();
      const localBorrowed = getBorrowedData();
      const localReturned = getReturnedData();
      updateDerivedSections(localBooks, localBorrowed, localReturned);
      setLoading(false);
    };

    loadCurrentUser();
    window.addEventListener('user-updated', loadCurrentUser);

    return () => window.removeEventListener('user-updated', loadCurrentUser);
  }, [fetchStudentData, loadPenaltySettings]);

  useEffect(() => {
    loadAnnouncementSettings();
  }, [loadAnnouncementSettings]);

  const guestStats = [
    { key: 'titles', value: summaryData.totalBooks, label: 'Book titles', hint: 'Unique titles in catalog', icon: statIcons.totalBooks },
    { key: 'copies', value: summaryData.availableCopies, label: 'Copies available', hint: 'Physical copies ready to borrow', icon: statIcons.availableCopies, tone: 'borrowed' },
    { key: 'categories', value: summaryData.categories, label: 'Categories', hint: 'Subject areas offered', icon: statIcons.categories, tone: 'returned' },
    { key: 'hours', value: '8 AM–7 PM', label: 'Open hours', hint: 'Mon–Fri', icon: statIcons.openHours }
  ];

  const memberStats = [
    { key: 'borrowed', value: summaryData.borrowed, label: 'Currently borrowed', icon: statIcons.borrowed, tone: 'borrowed' },
    { key: 'returned', value: summaryData.returned, label: 'Returned', icon: statIcons.returned, tone: 'returned' },
    { key: 'overdue', value: summaryData.overdue, label: 'Overdue', icon: statIcons.overdue, tone: 'overdue' },
    { key: 'titles', value: summaryData.totalBooks, label: 'Titles in catalog', icon: statIcons.totalBooks }
  ];

  const statsToRender = isGuest ? guestStats : memberStats;

  return (
    <div className="student-home">
      <section className="home-hero">
        <div className="home-hero-copy">
          {isGuest ? (
            <>
              <p className="home-eyebrow">Guest mode</p>
              <h2>Browse the library catalog</h2>
              <p className="home-lead">Browse the catalog and discover titles. Create an account when you&apos;re ready to borrow and track due dates.</p>
            </>
          ) : (
            <>
              <p className="home-eyebrow">Welcome back, {user.first_name}</p>
              <h2>Your library dashboard</h2>
              <p className="home-lead">Search the catalog, manage borrowed books, and stay on top of return deadlines.</p>
              <p className="home-meta-line">{user.email}</p>
            </>
          )}
          <p className="home-meta-line">Open Monday–Friday, 8:00 AM to 7:00 PM</p>
          <div className="home-hero-actions">
            <Link to="/student-dashboard/books" className="action-btn">Search books</Link>
            {!isGuest && (
              <>
                <Link to="/student-dashboard/borrowed" className="action-btn secondary-btn">My borrowed books</Link>
                <Link to="/student-dashboard/returned" className="action-btn secondary-btn">Returns</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {!loading && !isGuest && (summaryData.penaltyDue > 0 || !summaryData.canBorrow) && (
        <section className="home-alert" id="penalty-alert" aria-live="polite">
          <strong>Penalty notice</strong>
          <p>
            {summaryData.canBorrow
              ? `You have PHP ${summaryData.penaltyDue} in late fees. Borrowing is still allowed during the grace period.`
              : `Borrowing is paused until overdue items are returned. Current late fees: PHP ${summaryData.penaltyDue}.`}
          </p>
        </section>
      )}

      <section className="home-stats" aria-label="Library statistics">
        {loading ? (
          <div className="home-stats-grid">
            {Array.from({ length: 4 }).map((item) => (
              <div key={item} className="home-stat-card skeleton-card">
                <div className="skeleton-block" />
                <div className="skeleton-line wide" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        ) : (
          <div className="home-stats-grid">
            {statsToRender.map((stat) => (
              <article key={stat.key} className={`home-stat-card ${stat.tone || ''}`} title={stat.hint || stat.label}>
                <div className="home-stat-icon" aria-hidden="true">{stat.icon}</div>
                <div>
                  <p className="home-stat-value">{stat.value}</p>
                  <p className="home-stat-label">{stat.label}</p>
                  {stat.hint && <p className="home-stat-hint">{stat.hint}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="home-guides-grid">
        <section className="home-panel home-panel-flat" id="how-to-borrow">
          <h3 className="home-panel-title">How to borrow</h3>
          <ol className="home-guide-list">
            <li>Search the catalog and open a book preview.</li>
            <li>
              {isGuest
                ? 'Create an account, then click borrow on an available title.'
                : 'Click borrow on an available title.'}
            </li>
            <li>Track due dates under Borrowed books.</li>
            <li>Return on time to avoid daily penalties after the {penaltyPolicy.graceDays}-day grace period.</li>
          </ol>
        </section>

        <section className="home-panel home-panel-flat" id="rules-help">
          <h3 className="home-panel-title">Library rules</h3>
          <ul className="home-guide-list bullets">
            <li>Up to 3 books per account · 14-day loan period</li>
            <li>Late fee: PHP {penaltyPolicy.dailyFee}/day after {penaltyPolicy.graceDays} grace days</li>
            <li>Borrowing block after {penaltyPolicy.blockOverdueDays} overdue days</li>
            <li>Help: <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a></li>
          </ul>
        </section>
      </div>

      <section className="home-panel home-panel-elevated">
        <div className="home-panel-head">
          <h3 className="home-panel-title">Recommended for you</h3>
          <Link to="/student-dashboard/books" className="home-panel-link">View all books</Link>
        </div>
        {recommendedBooks.length > 0 ? (
          <div className="home-recommendations">
            {recommendedBooks.map((book) => (
              <Link
                key={book.id}
                to="/student-dashboard/books"
                className="home-rec-card"
                title={book.title}
              >
                <img
                  src={resolveCoverPath(book.cover)}
                  alt=""
                  className="home-rec-cover"
                  loading="lazy"
                />
                <div className="home-rec-body">
                  <h4>{book.title}</h4>
                  <p className="home-rec-author">{book.author}</p>
                  <div className="home-rec-meta">
                    <span className="home-rec-availability">{book.available} copies available</span>
                    <span className={`category-pill ${getCategoryTone(book.category)}`}>{book.category}</span>
                  </div>
                </div>
                <span className="home-rec-cta" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="home-empty">No recommendations right now. Browse the catalog to find available titles.</p>
        )}
      </section>

      <section className="home-panel home-panel-muted" id="announcements">
        <h3 className="home-panel-title">Announcements</h3>
        {announcementLoading ? (
          <p className="home-empty">Loading announcements...</p>
        ) : announcement?.enabled && announcement?.message?.trim() ? (
          <article className="home-announcement">
            <div className="home-announcement-head">
              <h4>{announcement.title || 'Library notice'}</h4>
              {announcement.updatedAt && (
                <time className="home-announcement-date" dateTime={announcement.updatedAt}>
                  Updated {formatDisplayDate(announcement.updatedAt)}
                </time>
              )}
            </div>
            <p>{announcement.message}</p>
          </article>
        ) : (
          <p className="home-empty">No announcements at this time. Check back later for library updates.</p>
        )}
      </section>

      <footer className="site-footer">
        <div className="site-footer-grid">
          <div>
            <strong>CVSU Library</strong>
            <p>Campus library services and digital catalog.</p>
          </div>
          <div className="site-footer-links">
            <a href="tel:+639157727986">+63 915 772 7986</a>
            <a href="https://library.cvsu.dev/" rel="noreferrer">library.cvsu.dev</a>
            <a href="mailto:contact@cvsu.dev">contact@cvsu.dev</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StudentHome;
