import React, { useState, useEffect } from 'react';
import { getBorrowedData, returnBorrowedBook, syncBorrowedFromServer } from './studentStorage';

const Borrowed = () => {
  const [borrowedBooks, setBorrowedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  const loadBorrowed = async () => {
    setLoading(true);
    try {
      await syncBorrowedFromServer();
    } catch (err) {
      // ignore sync errors and fall back to local data
    }
    setBorrowedBooks(getBorrowedData());
    setLoading(false);
  };

  useEffect(() => {
    loadBorrowed();
  }, []);

  const handleReturn = (id) => {
    const result = returnBorrowedBook(id);
    setMessage(result.message);
    loadBorrowed();
  };

  const filteredBorrowed = borrowedBooks.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.borrowDate.includes(searchQuery) ||
    book.dueDate.includes(searchQuery)
  );

  return (
    <div className="borrowed-page">
      <div className="page-header">
        <h2>📖 Borrowed Books</h2>
        <p>Books you currently have borrowed</p>
      </div>
      <div className="search-container" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search borrowed books..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>
      {message && (
        <div className="no-results" style={{ padding: '12px', marginBottom: '16px' }}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="no-results">Loading...</div>
      ) : filteredBorrowed.length > 0 ? (
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Borrow Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Overdue Days</th>
                <th>Penalty (PHP)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBorrowed.map((book) => (
                <tr key={book.id}>
                  <td>{book.title}</td>
                  <td>{book.borrowDate}</td>
                  <td>{book.dueDate}</td>
                  <td>
                    <span className={`status-badge ${book.status}`}>
                      {book.status === 'overdue' ? 'Overdue' : 'Active'}
                    </span>
                  </td>
                  <td>{book.overdueDays > 0 ? book.overdueDays : '-'}</td>
                  <td>{book.penaltyAmount > 0 ? book.penaltyAmount : '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="action-btn"
                      onClick={() => handleReturn(book.id)}
                    >
                      Return
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-results">No borrowed books found</div>
      )}

      <style>{`
        .borrowed-page {
          padding: 0;
        }
        .page-header {
          margin-bottom: 30px;
        }
        .page-header h2 {
          font-size: 28px;
          margin-bottom: 8px;
          color: white;
        }
        .page-header p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }
        .status-badge.overdue {
          background: rgba(234, 67, 53, 0.2);
          color: #ea4335;
        }
        .status-badge.active {
          background: rgba(66, 133, 244, 0.2);
          color: #4285f4;
        }
        .action-btn {
          padding: 6px 14px;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .action-btn:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
};

export default Borrowed;
