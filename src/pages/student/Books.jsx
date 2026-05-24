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

  const getFavoritesStorageKey = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return `library.student.${user.email || 'guest'}.favorites`;
  };

  const getNotifyStorageKey = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return `library.student.${user.email || 'guest'}.notifyRequests`;
  };

  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [message, setMessage] = useState('');
  const [borrowedBookIds, setBorrowedBookIds] = useState([]);
  const [favoriteBookIds, setFavoriteBookIds] = useState([]);
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

      const savedFavorites = JSON.parse(localStorage.getItem(getFavoritesStorageKey()) || '[]');
      setFavoriteBookIds(Array.isArray(savedFavorites) ? savedFavorites : []);
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
      book.title.toLowerCase().includes(normalizedQuery)
      || book.author.toLowerCase().includes(normalizedQuery)
      || book.category.toLowerCase().includes(normalizedQuery)
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

  const filteredBooks = useMemo(() => books.filter((book) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
    || book.author.toLowerCase().includes(searchQuery.toLowerCase())
    || book.category.toLowerCase().includes(searchQuery.toLowerCase())
  ), [books, searchQuery]);

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

  const toggleFavorite = (bookId) => {
    if (!isAuthenticated()) {
      setMessage('Login first to save favorite and borrow books.');
      return;
    }

    setFavoriteBookIds((prev) => {
      const next = prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId];

      localStorage.setItem(getFavoritesStorageKey(), JSON.stringify(next));
      return next;
    });
  };

  const handleNotifyMe = (bookId) => {
    if (!isAuthenticated()) {
      setMessage('Login first to request notifications for unavailable books.');
      return;
    }

    const stored = JSON.parse(localStorage.getItem(getNotifyStorageKey()) || '[]');
    const requests = Array.isArray(stored) ? stored : [];
    const next = requests.includes(bookId) ? requests : [...requests, bookId];

    localStorage.setItem(getNotifyStorageKey(), JSON.stringify(next));
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
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="preview-close" onClick={closePreview} aria-label="Close preview">x</button>
            <div className="preview-layout">
              <img
                src={resolveCoverPath(selectedBook.cover)}
                alt={`${selectedBook.title} cover`}
                className="preview-cover"
                onError={(event) => {
                  if (event.currentTarget.src.includes(fallbackCover)) return;
                  event.currentTarget.src = fallbackCover;
                }}
              />
                <div className="preview-details">
                  <h3>{selectedBook.title}</h3>
                  <p className="book-author">by {selectedBook.author}</p>
                  <p className="book-category">{selectedBook.category}</p>
                  {selectedBook.qr_image_url && (
                    <div style={{ marginBottom: '14px' }}>
                      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px' }}>Book QR Code</p>
                      <img
                        src={resolveQrPath(selectedBook.qr_image_url)}
                        alt={`${selectedBook.title} QR`}
                        style={{ width: '140px', height: '140px', objectFit: 'contain', background: 'white', borderRadius: '10px', padding: '8px' }}
                      />
                    </div>
                  )}
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
                    >
                      Notify Me
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
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
          background: rgba(4, 8, 16, 0.84);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
          padding: 20px;
        }
        .preview-modal {
          width: min(920px, 100%);
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(18, 25, 38, 0.96), rgba(11, 16, 28, 0.98));
          border: 1px solid rgba(255, 255, 255, 0.16);
          padding: 22px;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }
        .preview-close {
          position: absolute;
          right: 12px;
          top: 12px;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          cursor: pointer;
        }
        .preview-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 20px;
        }
        .preview-cover {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          object-fit: cover;
          max-height: 300px;
        }
        .preview-details h3 {
          font-size: 28px;
          color: #fff;
          margin-bottom: 6px;
        }
        .preview-intro {
          margin-top: 8px;
          margin-bottom: 12px;
          color: rgba(255, 255, 255, 0.86);
          line-height: 1.6;
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
          margin-bottom: 14px;
          display: grid;
          gap: 4px;
        }
        .preview-policy p {
          color: rgba(255, 255, 255, 0.82);
          font-size: 14px;
        }
        .preview-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
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
        }
        @media (max-width: 900px) {
          .preview-layout {
            grid-template-columns: 1fr;
          }
          .preview-cover {
            max-height: 260px;
            width: min(280px, 100%);
          }
        }
        @media (max-width: 720px) {
          .books-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 520px) {
          .book-card {
            flex-direction: column;
          }
          .book-cover-wrap {
            width: 100%;
            height: 180px;
          }
          .preview-modal {
            padding: 16px;
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
