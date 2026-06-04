import React from 'react';
import AdminNavIcon from '../components/AdminNavIcon';
import { getBookQuantity, getBookAvailable, isLowStockBook, getStockBadgeClass } from '../utils/bookHelpers';

const AdminBooksSection = ({ admin }) => {
  const {
    searchQuery, setSearchQuery, stockFilter, setStockFilter, handleExportCsv, formVisible,
    setEditingId, setForm, emptyForm, setCoverFile, setCoverPreviewUrl, setBookFormStatus,
    setQrFile, setFormVisible, loading, filteredBooks, paginatedBooks, handleEdit,
    handleGenerateBookQr, qrGeneratingId, handleRestock, handleArchive, pageStart, pageEnd,
    currentBookPage, bookPageCount, setBookPage
  } = admin;

  return (
    <>
      <div className="admin-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="stock-filter-group" aria-label="Stock filter">
          {[
            ['all', 'All Stock'],
            ['low', 'Low Stock'],
            ['out', 'Out of Stock']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-chip ${stockFilter === value ? 'active' : ''}`}
              onClick={() => setStockFilter(value)}
              aria-pressed={stockFilter === value}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="action-btn" onClick={handleExportCsv}>Export CSV</button>
        {!formVisible && (
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setCoverFile(null);
              setCoverPreviewUrl('');
              setBookFormStatus('');
              setQrFile(null);
              setFormVisible(true);
            }}
          >
            Add New Book
          </button>
        )}
      </div>

      <div className="admin-grid single-column">
        <div className="content-section inventory-section">
          <div className="section-heading-row">
            <h3 className="section-title">Books Inventory</h3>
          </div>
          <div className="table-container admin-table-scroll">
            <table className="activity-table book-inventory-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th className="numeric-cell">Qty</th>
                  <th className="numeric-cell">Avail</th>
                  <th className="media-cell">Cover</th>
                  <th className="media-cell">QR</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="no-results">Loading...</td></tr>
                ) : filteredBooks.length > 0 ? (
                  paginatedBooks.map((book) => (
                    <tr key={book.id} className={isLowStockBook(book) ? 'low-stock-row' : ''}>
                      <td>{book.title}</td>
                      <td>{book.author}</td>
                      <td>{book.category || '-'}</td>
                      <td className="numeric-cell">{getBookQuantity(book)}</td>
                      <td className="numeric-cell">
                        <span className={getStockBadgeClass(book)}>
                          {getBookAvailable(book)}
                        </span>
                      </td>
                      <td className="media-cell">
                        {book.cover_image_url ? (
                          <img
                            src={book.cover_image_url}
                            alt={`${book.title} cover`}
                            className="book-cover-thumb"
                          />
                        ) : '-'}
                      </td>
                      <td className="media-cell">
                        {book.qr_image_url ? (
                          <img
                            src={book.qr_image_url}
                            alt={`${book.title} QR`}
                            className="book-qr-thumb"
                          />
                        ) : '-'}
                      </td>
                      <td className="book-actions-cell">
                        <div className="book-actions">
                          <button type="button" className="table-btn icon-btn" onClick={() => handleEdit(book)} title="Edit book" aria-label={`Edit ${book.title}`}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="table-btn icon-btn"
                            onClick={() => handleGenerateBookQr(book)}
                            disabled={qrGeneratingId === Number(book.id)}
                            title={book.qr_image_url ? 'Regenerate QR' : 'Generate QR'}
                            aria-label={`${book.qr_image_url ? 'Regenerate QR for' : 'Generate QR for'} ${book.title}`}
                          >
                            {qrGeneratingId === Number(book.id) ? '...' : 'QR'}
                          </button>
                          <button type="button" className="table-btn icon-btn" onClick={() => handleRestock(book)} title="Add one copy" aria-label={`Add one copy to ${book.title}`}>
                            +1
                          </button>
                          <details className="row-action-menu">
                            <summary aria-label={`More actions for ${book.title}`}>More</summary>
                            <button type="button" className="menu-action danger" onClick={() => handleArchive(book.id, book.title)}>Archive</button>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" className="no-results">No books found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredBooks.length > 0 && (
            <div className="table-footer">
              <span>Showing {pageStart}-{pageEnd} of {filteredBooks.length} books</span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => setBookPage((page) => Math.max(1, page - 1))}
                  disabled={currentBookPage === 1}
                >
                  Previous
                </button>
                <span>Page {currentBookPage} of {bookPageCount}</span>
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => setBookPage((page) => Math.min(bookPageCount, page + 1))}
                  disabled={currentBookPage === bookPageCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminBooksSection;
