import React, { useState, useEffect } from 'react';
import { getReturnedData } from './studentStorage';

const Returned = () => {
  const [returnedBooks, setReturnedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setReturnedBooks(getReturnedData());
    setLoading(false);
  }, []);

  const filteredReturned = returnedBooks.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.borrowDate.includes(searchQuery) ||
    book.returnDate.includes(searchQuery)
  );

  return (
    <div className="returned-page">
      <div className="page-header">
        <h2>✅ Returned Books</h2>
        <p>History of your returned books</p>
      </div>
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

      <style>{`
        .returned-page {
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
        .status-badge.completed {
          background: rgba(52, 168, 83, 0.2);
          color: #34a853;
        }
      `}</style>
    </div>
  );
};

export default Returned;
