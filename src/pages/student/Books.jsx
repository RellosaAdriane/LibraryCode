import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import {
  borrowBookById,
  getBooksData,
  getBorrowedData,
  setBooksData,
  getPenaltyPolicy,
  setPenaltyPolicy
} from './studentStorage';
import { isAuthenticated } from '../../auth';

const Books = () => {
  const fallbackCover = '/book-covers/javascript-good-parts.svg';

  const resolveCoverPath = (cover) => {
    if (!cover) return fallbackCover;
    if (cover.startsWith('http://') || cover.startsWith('https://') || cover.startsWith('/')) {
      return cover;
    }
    return `/book-covers/${cover}`;
  };

  const resolveQrPath = (qrUrl) => {
    if (!qrUrl) return '';
    if (qrUrl.startsWith('http://') || qrUrl.startsWith('https://') || qrUrl.startsWith('data:')) {
      return qrUrl;
    }
    if (qrUrl.startsWith('/')) {
      return `${window.location.protocol}//${window.location.host}${qrUrl}`;
    }
    return `${window.location.protocol}//${window.location.host}/${qrUrl}`;
  };

  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [sortMode, setSortMode] = useState('title');
  const [searchMessage, setSearchMessage] = useState('');
  const [message, setMessage] = useState('');
  const [borrowedBookIds, setBorrowedBookIds] = useState([]);
  const [favoriteBookIds, setFavoriteBookIds] = useState([]);
  const [notifyBookIds, setNotifyBookIds] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [penaltyPolicy, setPenaltyPolicyState] = useState(getPenaltyPolicy());
  const [speaking, setSpeaking] = useState(false);
  const [previewSpeaking, setPreviewSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const [lastVoiceQuery, setLastVoiceQuery] = useState('');

  useEffect(() => {
    if (!searchMessage) return undefined;

    const timeoutId = window.setTimeout(() => {
      setSearchMessage('');
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [searchMessage]);

  useEffect(() => {
    const loadBooks = async () => {
      const result = await api.getBooks();
      if (result.success && Array.isArray(result.books)) {
        setBooksData(result.books);
      }

      const penaltyResult = await api.getPenaltySettings();
      if (penaltyResult.success && penaltyResult.settings) {
        setPenaltyPolicy(penaltyResult.settings);
        setPenaltyPolicyState({
          graceDays: Number(penaltyResult.settings.grace_days ?? 7),
          dailyFee: Number(penaltyResult.settings.daily_fee ?? 150),
          blockOverdueDays: Number(penaltyResult.settings.block_overdue_days ?? 14)
        });
      }

      setBooks(getBooksData());
      setBorrowedBookIds(getBorrowedData().map((item) => item.bookId));

      if (isAuthenticated()) {
        const collection = await api.getStudentCollection();
        if (collection.success && collection.data) {
          setFavoriteBookIds(Array.isArray(collection.data.favorite) ? collection.data.favorite : []);
          setNotifyBookIds(Array.isArray(collection.data.notify) ? collection.data.notify : []);
        }
      }
      setLoading(false);
    };

    loadBooks();
  }, []);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setSelectedBookId(null);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (!lastVoiceQuery) return;
    const normalizedQuery = lastVoiceQuery.trim().toLowerCase();
    if (!normalizedQuery) return;
    if (searchQuery.trim().toLowerCase() !== normalizedQuery) return;

    const matchCount = books.filter((book) =>
      String(book.title || '').toLowerCase().includes(normalizedQuery)
      || String(book.author || '').toLowerCase().includes(normalizedQuery)
      || String(book.category || '').toLowerCase().includes(normalizedQuery)
    ).length;
    const label = matchCount === 1 ? 'result' : 'results';

    setSearchMessage(`Found ${matchCount} ${label} for "${lastVoiceQuery}"`);
    setLastVoiceQuery('');
  }, [lastVoiceQuery, searchQuery, books]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const categories = useMemo(() => (
    Array.from(new Set(books.map((book) => book.category).filter(Boolean))).sort()
  ), [books]);

  const authors = useMemo(() => (
    Array.from(new Set(books.map((book) => book.author).filter(Boolean))).sort()
  ), [books]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = books.filter((book) => {
      const title = String(book.title || '').toLowerCase();
      const author = String(book.author || '').toLowerCase();
      const category = String(book.category || '').toLowerCase();
      const available = Number(book.available || 0);

      const matchesQuery = !query
        || title.includes(query)
        || author.includes(query)
        || category.includes(query);
      const matchesCategory = categoryFilter === 'all' || book.category === categoryFilter;
      const matchesAuthor = authorFilter === 'all' || book.author === authorFilter;
      const matchesAvailability = availabilityFilter === 'all'
        || (availabilityFilter === 'available' && available > 0)
        || (availabilityFilter === 'unavailable' && available <= 0);

      return matchesQuery && matchesCategory && matchesAuthor && matchesAvailability;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === 'recent') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      if (sortMode === 'popular') {
        return Number(b.borrow_count || 0) - Number(a.borrow_count || 0);
      }
      if (sortMode === 'availability') {
        return Number(b.available || 0) - Number(a.available || 0);
      }
      return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }, [books, searchQuery, categoryFilter, authorFilter, availabilityFilter, sortMode]);

  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) || null, [books, selectedBookId]);

  const refreshCollectionState = () => {
    setBooks(getBooksData());
    setBorrowedBookIds(getBorrowedData().map((item) => item.bookId));
  };

  const handleBorrow = async (bookId) => {
    if (!isAuthenticated()) {
      setMessage('Please login or create an account to borrow books.');
      return;
    }

    const result = await borrowBookById(bookId);
    setMessage(result.message);
    refreshCollectionState();
  };

  const handlePreview = (bookId) => {
    setSelectedBookId(bookId);
  };

  const closePreview = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewSpeaking(false);
    setSelectedBookId(null);
  };

  const toggleFavorite = async (bookId) => {
    if (!isAuthenticated()) {
      setMessage('Login first to save favorite and borrow books.');
      return;
    }

    const saved = favoriteBookIds.includes(bookId);
    const result = saved
      ? await api.removeStudentCollectionItem({ bookId, type: 'favorite' })
      : await api.saveStudentCollectionItem({ bookId, type: 'favorite' });

    if (!result.success) {
      setMessage(result.message || 'Unable to update favorites.');
      return;
    }

    setFavoriteBookIds((prev) => (
      saved ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    ));
    setMessage(saved ? 'Removed from favorites.' : 'Added to favorites.');
  };

  const handleNotifyMe = async (bookId) => {
    if (!isAuthenticated()) {
      setMessage('Login first to request notifications for unavailable books.');
      return;
    }

    const result = await api.saveStudentCollectionItem({ bookId, type: 'notify' });
    if (!result.success) {
      setMessage(result.message || 'Unable to save notification request.');
      return;
    }

    setNotifyBookIds((prev) => (prev.includes(bookId) ? prev : [...prev, bookId]));
    setMessage('Notification request saved. We will notify you once this book is available.');
  };

  const handleSpeakSection = () => {
    if (!('speechSynthesis' in window)) {
      setMessage('Text-to-speech is not supported in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const text = `Available Books. Browse our library collection. ${
      searchQuery ? `Current search is ${searchQuery}.` : 'No active search filter.'
    } Showing ${filteredBooks.length} result${filteredBooks.length === 1 ? '' : 's'}.`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const handleSpeakBookPreview = () => {
    if (!selectedBook) return;
    if (!('speechSynthesis' in window)) {
      setMessage('Text-to-speech is not supported in this browser.');
      return;
    }

    if (previewSpeaking) {
      window.speechSynthesis.cancel();
      setPreviewSpeaking(false);
      return;
    }

    const text = `${selectedBook.title}. Author: ${selectedBook.author}. Category: ${selectedBook.category}. ${
      selectedBook.intro || 'No summary available for this title yet.'
    } ${selectedBook.available > 0 ? `${selectedBook.available} copies available.` : 'Currently not available.'}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setPreviewSpeaking(false);
    utterance.onerror = () => setPreviewSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setPreviewSpeaking(true);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSearchMessage('Enter a search term first');
      return;
    }

    setSearchMessage(`Searching for "${trimmedQuery}"`);
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSearchMessage('Voice search is not supported in this browser.');
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      setSearchMessage('Voice search stopped');
      return;
    }

    const recognition = recognitionRef.current || new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setSearchMessage('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setSearchQuery(transcript);
        setSearchMessage(`Searching for "${transcript}"`);
        setLastVoiceQuery(transcript);
      } else {
        setSearchMessage('No speech detected. Try again.');
      }
    };

    recognition.onerror = (event) => {
      const reason = event?.error ? ` (${event.error})` : '';
      setSearchMessage(`Voice search failed. Check your microphone permissions.${reason}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };


  return (
    <div className="books-page">
      <div className="page-header">
        <h2>Available Books</h2>
        <p>Browse our library collection</p>
      </div>

      <form className="books-search" onSubmit={handleSearchSubmit}>
        <label className="sr-only" htmlFor="books-search-input">
          Search available books
        </label>
        <div className="books-search-bar">
          <input
            id="books-search-input"
            type="search"
            placeholder="Search books by title, author, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="books-search-input"
          />
          <button type="submit" className="books-search-btn books-search-btn-primary" aria-label="Search">
            <span aria-hidden="true">🔍</span>
          </button>
          <button
            type="button"
            className={`books-search-btn books-search-btn-voice ${listening ? 'is-listening' : ''}`}
            onClick={handleVoiceSearch}
            aria-label={listening ? 'Stop voice search' : 'Voice search'}
            aria-pressed={listening}
          >
            <span aria-hidden="true">🎤</span>
          </button>
        </div>
        <p className={`books-search-message ${searchMessage ? 'visible' : ''}`} aria-live="polite">
          {searchMessage}
        </p>
      </form>
      <div className="catalog-filters" aria-label="Catalog filters">
        <label>
          <span>Category</span>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Availability</span>
          <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
            <option value="all">All books</option>
            <option value="available">Available now</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </label>
        <label>
          <span>Author</span>
          <select value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
            <option value="all">All authors</option>
            {authors.map((author) => (
              <option key={author} value={author}>{author}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="title">Title A-Z</option>
            <option value="recent">Recently added</option>
            <option value="popular">Most borrowed</option>
            <option value="availability">Most available</option>
          </select>
        </label>
      </div>
      <div className="tts-toolbar">
        <span className="tts-label">Text to Speech</span>
        <button type="button" className="action-btn small-btn" onClick={handleSpeakSection}>
          {speaking ? 'Stop Reading' : 'Read This Section'}
        </button>
      </div>

      {message && (
        <div className="no-results" style={{ padding: '12px', marginBottom: '18px' }}>
          {message}
          {!isAuthenticated() && (
            <div style={{ marginTop: '10px' }}>
              <button type="button" className="action-btn" onClick={() => navigate('/login')}>
                Login / Create Account
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="no-results">Loading books...</div>
      ) : (
        <div className="books-grid">
          {filteredBooks.length > 0 ? (
            filteredBooks.map((book) => (
              <div key={book.id} className="book-card">
                <div className="book-cover-wrap">
                  <img
                    src={resolveCoverPath(book.cover)}
                    alt={`${book.title} cover`}
                    className="book-cover"
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.src.includes(fallbackCover)) return;
                      event.currentTarget.src = fallbackCover;
                    }}
                  />
                </div>
                <div className="book-info">
                  <h3>{book.title}</h3>
                  <p className="book-author">by {book.author}</p>
                  <p className="book-category">{book.category}</p>
                  <p className="book-intro">{book.intro || 'A recommended read from the library collection.'}</p>
                  <div className="book-availability">
                    <span className={`availability-badge ${book.available > 0 ? 'available' : 'unavailable'}`}>
                      {book.available > 0 ? `${book.available} available` : 'Not available'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="action-btn borrow-btn"
                    onClick={() => handlePreview(book.id)}
                  >
                    Preview
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-results">No books found matching your search</div>
          )}
        </div>
      )}

      {selectedBook && (
        <div className="preview-modal-backdrop" onClick={closePreview} role="presentation">
          <div className="preview-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="preview-book-title">
            <div className="preview-modal-header">
              <button type="button" className="preview-close" onClick={closePreview} aria-label="Close preview">x</button>
            </div>
            <div className="preview-modal-body">
              <div className="preview-layout">
                <aside className="preview-media-column">
                  <img
                    src={resolveCoverPath(selectedBook.cover)}
                    alt={`${selectedBook.title} cover`}
                    className="preview-cover"
                    onError={(event) => {
                      if (event.currentTarget.src.includes(fallbackCover)) return;
                      event.currentTarget.src = fallbackCover;
                    }}
                  />
                  {selectedBook.qr_image_url && (
                    <div className="preview-qr-card">
                      <p>Book QR Code</p>
                      <img
                        src={resolveQrPath(selectedBook.qr_image_url)}
                        alt={`${selectedBook.title} QR`}
                        className="preview-qr-image"
                      />
                    </div>
                  )}
                </aside>
                <div className="preview-details">
                  <h3 id="preview-book-title">{selectedBook.title}</h3>
                  <p className="book-author">by {selectedBook.author}</p>
                  <p className="book-category">{selectedBook.category}</p>
                  <p className="preview-intro">{selectedBook.intro || 'No summary available for this title yet.'}</p>
                  <div className="preview-tts">
                    <span>Text to Speech</span>
                    <button type="button" className="action-btn small-btn" onClick={handleSpeakBookPreview}>
                      {previewSpeaking ? 'Stop Reading Book' : 'Read Book Details'}
                    </button>
                  </div>
                  <div className="preview-badges">
                    <span className={`availability-badge ${selectedBook.available > 0 ? 'available' : 'unavailable'}`}>
                      {selectedBook.available > 0 ? `${selectedBook.available} copies available` : 'Not available'}
                    </span>
                    {borrowedBookIds.includes(selectedBook.id) && (
                      <span className="availability-badge unavailable">Already borrowed</span>
                    )}
                  </div>

                  <div className="preview-policy">
                    <p><strong>Borrow period:</strong> 14 days</p>
                    <p><strong>Max books allowed:</strong> 3 books</p>
                    <p><strong>Late return policy:</strong> {penaltyPolicy.graceDays}-day grace, then PHP {penaltyPolicy.dailyFee} per day.</p>
                    <p><strong>Borrowing block:</strong> Disabled after {penaltyPolicy.blockOverdueDays} overdue days.</p>
                  </div>

                  <div className="preview-actions">
                    <button
                      type="button"
                      className="action-btn"
                      disabled={selectedBook.available <= 0 || borrowedBookIds.includes(selectedBook.id)}
                      onClick={() => handleBorrow(selectedBook.id)}
                    >
                      {borrowedBookIds.includes(selectedBook.id) ? 'Already Borrowed' : 'Borrow Now'}
                    </button>

                    <button
                      type="button"
                      className="action-btn secondary-btn"
                      onClick={() => toggleFavorite(selectedBook.id)}
                    >
                      {favoriteBookIds.includes(selectedBook.id) ? 'Remove Favorite' : 'Add to Favorites'}
                    </button>

                    {selectedBook.available <= 0 && (
                      <button
                        type="button"
                        className="action-btn secondary-btn"
                        onClick={() => handleNotifyMe(selectedBook.id)}
                        disabled={notifyBookIds.includes(selectedBook.id)}
                      >
                        {notifyBookIds.includes(selectedBook.id) ? 'Alert Saved' : 'Notify Me'}
                      </button>
                    )}
                  </div>

                  {!isAuthenticated() && (
                    <div className="preview-login-note">
                      <p>Login is required to borrow, save favorites, and receive availability alerts.</p>
                      <button type="button" className="action-btn small-btn" onClick={() => navigate('/login')}>
                        Login / Create Account
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .books-page {
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
        .books-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }
        .catalog-filters {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          margin: -10px 0 20px;
        }
        .catalog-filters label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .catalog-filters select {
          min-width: 0;
          height: 42px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.08);
          color: white;
          padding: 0 10px;
          font: inherit;
          text-transform: none;
          letter-spacing: 0;
        }
        .catalog-filters option {
          color: #111827;
        }
        .tts-toolbar {
          margin: -10px 0 22px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .tts-label {
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          font-weight: 600;
        }
        .book-card {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: transform 0.2s ease;
        }
        .book-card:hover {
          transform: translateY(-2px);
        }
        .book-cover-wrap {
          width: 88px;
          height: 118px;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.25);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
          flex-shrink: 0;
        }
        .book-cover {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .book-info {
          flex: 1;
          min-width: 0;
        }
        .book-info h3 {
          font-size: 16px;
          color: white;
          margin-bottom: 5px;
          line-height: 1.3;
        }
        .book-author {
          color: rgba(255, 255, 255, 0.78);
          font-size: 13px;
          margin-bottom: 5px;
        }
        .book-category {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          margin-bottom: 8px;
        }
        .book-intro {
          color: rgba(255, 255, 255, 0.75);
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 12px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .availability-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }
        .availability-badge.available {
          background: rgba(52, 168, 83, 0.2);
          color: #34a853;
        }
        .availability-badge.unavailable {
          background: rgba(234, 67, 53, 0.2);
          color: #ea4335;
        }
        .borrow-btn {
          margin-top: 10px;
          width: 100%;
        }
        .preview-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 18, 0.92);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: clamp(16px, 4vh, 32px);
        }
        .preview-modal {
          width: min(760px, 100%);
          max-height: min(82vh, 760px);
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(16, 23, 36, 0.98), rgba(8, 13, 24, 0.99));
          border: 1px solid rgba(255, 255, 255, 0.16);
          position: relative;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.62);
          display: flex;
          flex-direction: column;
        }
        .preview-modal-header {
          min-height: 54px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(8, 13, 24, 0.72);
          flex-shrink: 0;
        }
        .preview-modal-body {
          overflow-y: auto;
          padding: 22px 26px 26px;
          scrollbar-width: thin;
          scrollbar-color: rgba(118, 75, 162, 0.75) rgba(255, 255, 255, 0.06);
        }
        .preview-modal-body::-webkit-scrollbar {
          width: 10px;
        }
        .preview-modal-body::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 999px;
          margin: 10px 4px;
        }
        .preview-modal-body::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 999px;
          border: 2px solid rgba(8, 13, 24, 0.95);
        }
        .preview-close {
          position: sticky;
          top: 0;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.14);
          color: white;
          cursor: pointer;
          font-size: 16px;
          font-weight: 800;
        }
        .preview-close:hover {
          background: rgba(255, 255, 255, 0.22);
        }
        .preview-layout {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 24px;
          align-items: start;
        }
        .preview-media-column {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: center;
        }
        .preview-cover {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          object-fit: cover;
          max-height: 285px;
          box-shadow: 0 18px 34px rgba(0, 0, 0, 0.34);
        }
        .preview-qr-card {
          width: 100%;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          padding: 12px;
          text-align: center;
        }
        .preview-qr-card p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .preview-qr-image {
          width: min(132px, 100%);
          height: auto;
          aspect-ratio: 1;
          object-fit: contain;
          background: white;
          border-radius: 10px;
          padding: 8px;
        }
        .preview-details {
          max-width: 500px;
        }
        .preview-details h3 {
          font-size: clamp(22px, 2.6vw, 30px);
          color: #fff;
          margin-bottom: 6px;
          line-height: 1.22;
        }
        .preview-intro {
          margin-top: 12px;
          margin-bottom: 16px;
          color: rgba(255, 255, 255, 0.86);
          line-height: 1.62;
          max-width: 62ch;
        }
        .preview-tts {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .preview-tts span {
          color: rgba(255, 255, 255, 0.82);
          font-size: 13px;
          font-weight: 600;
        }
        .preview-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 14px;
        }
        .preview-policy {
          margin-bottom: 16px;
          display: grid;
          gap: 7px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.09);
          padding: 12px;
        }
        .preview-policy p {
          color: rgba(255, 255, 255, 0.82);
          font-size: 14px;
        }
        .preview-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }
        .preview-actions .action-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .preview-login-note {
          margin-top: 14px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.06);
          padding: 12px;
        }
        .preview-login-note p {
          color: rgba(255, 255, 255, 0.86);
          font-size: 13px;
          margin-bottom: 8px;
        }
        @media (max-width: 1024px) {
          .books-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .catalog-filters {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .preview-modal {
            max-height: 86vh;
            width: min(620px, 100%);
          }
          .preview-layout {
            grid-template-columns: 1fr;
          }
          .preview-media-column {
            align-items: flex-start;
          }
          .preview-cover {
            max-height: 260px;
            width: min(280px, 100%);
          }
          .preview-qr-card {
            width: min(280px, 100%);
          }
          .preview-details {
            max-width: none;
          }
        }
        @media (max-width: 720px) {
          .books-grid {
            grid-template-columns: 1fr;
          }
          .catalog-filters {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .book-card {
            display: grid;
            grid-template-columns: 76px 1fr;
            padding: 12px;
          }
          .book-cover-wrap {
            width: 76px;
            height: 102px;
          }
          .preview-modal {
            max-height: 90vh;
          }
          .preview-modal-body {
            padding: 16px;
          }
          .preview-modal-header {
            min-height: 50px;
            padding: 8px 10px;
          }
          .preview-details h3 {
            font-size: 24px;
          }
          .preview-actions .action-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default Books;
