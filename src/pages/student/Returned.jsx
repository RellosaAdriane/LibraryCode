import React, { useState, useEffect } from 'react';
import { getReturnedData, syncReturnedFromServer } from './studentStorage';

const ReturnedIcon = () => (
  <svg
    className="page-header-icon-svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v15H7.5A2.5 2.5 0 0 0 5 19.5v-15Z" />
    <path d="m16 16-3 3-3-3" />
    <path d="M13 19v-6" />
  </svg>
);

const Returned = () => {
  const [returnedBooks, setReturnedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const loadReturned = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const result = await syncReturnedFromServer();
        if (result && result.success === false) {
          setLoadError(result.message || 'Unable to load returned books from the server.');
        }
      } catch (err) {
        setLoadError('Unable to load returned books. Showing saved data on this device.');
      } finally {
        setReturnedBooks(getReturnedData());
        setLoading(false);
      }
    };

    loadReturned();
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredReturned = returnedBooks.filter((book) => {
    const title = String(book?.title || '').toLowerCase();
    const borrowDate = String(book?.borrowDate || '');
    const returnDate = String(book?.returnDate || '');
    if (!normalizedQuery) return true;
    return title.includes(normalizedQuery)
      || borrowDate.includes(normalizedQuery)
      || returnDate.includes(normalizedQuery);
  });

  return (
    <div className="returned-page">
      <div className="page-header">
        <div className="page-header-title">
          <span className="page-header-icon returned-icon" aria-hidden="true">
            <ReturnedIcon />
          </span>
          <div>
            <h2>Returned Books</h2>
            <p>History of your returned books</p>
          </div>
        </div>
      </div>
      {loadError && (
        <div className="no-results" style={{ marginBottom: '16px' }} role="alert">
          {loadError}
        </div>
      )}

      <div className="search-container" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search returned books..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>

      {loading ? (
        <div className="no-results">Loading...</div>
      ) : filteredReturned.length > 0 ? (
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Borrow Date</th>
                <th>Return Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturned.map((book) => (
                <tr key={book.id}>
                  <td>{book.title}</td>
                  <td>{book.borrowDate}</td>
                  <td>{book.returnDate}</td>
                  <td>
                    <span className="status-badge completed">
                      Returned
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-results">No returned books found</div>
      )}
    </div>
  );
};

export default Returned;
