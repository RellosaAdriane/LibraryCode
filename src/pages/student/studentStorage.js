import { api } from '../../api';
import { getStoredUser, isAuthenticated } from '../../auth';

const STORAGE_PREFIX = 'library.student';

const DEFAULT_BOOKS = [
  // eslint-disable-next-line no-script-url
  {
    id: 1,
    title: 'JavaScript: The Good Parts',
    author: 'Douglas Crockford',
    category: 'Programming',
    available: 5,
    cover: '/book-covers/javascript-good-parts.svg',
    intro: 'A compact guide to the strongest features and best practices of JavaScript.'
  },
  {
    id: 2,
    title: 'Clean Code',
    author: 'Robert C. Martin',
    category: 'Programming',
    available: 3,
    cover: '/book-covers/clean-code.svg',
    intro: 'Learn practical habits for writing readable, maintainable, and professional code.'
  },
  {
    id: 3,
    title: 'Design Patterns',
    author: 'Gang of Four',
    category: 'Programming',
    available: 2,
    cover: '/book-covers/design-patterns.svg',
    intro: 'Classic software design solutions for common object-oriented development problems.'
  },
  {
    id: 4,
    title: 'Introduction to Algorithms',
    author: 'Thomas Cormen',
    category: 'Computer Science',
    available: 4,
    cover: '/book-covers/intro-to-algorithms.svg',
    intro: 'A foundational algorithms textbook covering theory, data structures, and analysis.'
  },
  {
    id: 5,
    title: 'The Pragmatic Programmer',
    author: 'David Thomas',
    category: 'Programming',
    available: 6,
    cover: '/book-covers/pragmatic-programmer.svg',
    intro: 'Timeless advice to improve developer mindset, craft, and day-to-day coding workflow.'
  },
  {
    id: 6,
    title: 'Computer Networking',
    author: 'James Kurose',
    category: 'Computer Science',
    available: 3,
    cover: '/book-covers/computer-networking.svg',
    intro: 'Clear explanation of networking concepts from application layer to network core.'
  },
  {
    id: 7,
    title: 'Database System Concepts',
    author: 'Silberschatz',
    category: 'Database',
    available: 4,
    cover: '/book-covers/database-system-concepts.svg',
    intro: 'Comprehensive overview of database design, SQL, transactions, and storage systems.'
  },
  {
    id: 8,
    title: 'Operating System Concepts',
    author: 'Abraham Silberschatz',
    category: 'Computer Science',
    available: 2,
    cover: '/book-covers/operating-system-concepts.svg',
    intro: 'Core operating system topics including processes, memory management, and scheduling.'
  },
  {
    id: 9,
    title: 'Artificial Intelligence',
    author: 'Stuart Russell',
    category: 'AI',
    available: 5,
    cover: '/book-covers/artificial-intelligence.svg',
    intro: 'A broad introduction to intelligent agents, reasoning, search, and learning systems.'
  },
  {
    id: 10,
    title: 'Machine Learning',
    author: 'Tom Mitchell',
    category: 'AI',
    available: 3,
    cover: '/book-covers/machine-learning.svg',
    intro: 'Introduces key machine learning ideas, models, and evaluation techniques.'
  }
];

const DEFAULT_BOOKS_BY_ID = DEFAULT_BOOKS.reduce((acc, book) => {
  acc[book.id] = book;
  return acc;
}, {});

const DEFAULT_NOTIFICATIONS = {
  email: true,
  push: false,
  weekly: true
};

const DEFAULT_PENALTY_POLICY = {
  graceDays: 7,
  dailyFee: 150,
  blockOverdueDays: 14
};

const PENALTY_POLICY_KEY = 'library.penaltyPolicy';

const formatDate = (date) => date.toISOString().slice(0, 10);
export const getPenaltyPolicy = () => {
  const stored = readJSON(PENALTY_POLICY_KEY, null);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_PENALTY_POLICY };
  }

  const graceDays = Number(stored.graceDays ?? stored.grace_days ?? DEFAULT_PENALTY_POLICY.graceDays);
  const dailyFee = Number(stored.dailyFee ?? stored.daily_fee ?? DEFAULT_PENALTY_POLICY.dailyFee);
  const blockOverdueDays = Number(stored.blockOverdueDays ?? stored.block_overdue_days ?? DEFAULT_PENALTY_POLICY.blockOverdueDays);

  return {
    graceDays: Number.isFinite(graceDays) ? graceDays : DEFAULT_PENALTY_POLICY.graceDays,
    dailyFee: Number.isFinite(dailyFee) ? dailyFee : DEFAULT_PENALTY_POLICY.dailyFee,
    blockOverdueDays: Number.isFinite(blockOverdueDays) ? blockOverdueDays : DEFAULT_PENALTY_POLICY.blockOverdueDays
  };
};

export const setPenaltyPolicy = (policy) => {
  if (!policy || typeof policy !== 'object') return;
  const nextPolicy = {
    graceDays: Number(policy.graceDays ?? policy.grace_days ?? DEFAULT_PENALTY_POLICY.graceDays),
    dailyFee: Number(policy.dailyFee ?? policy.daily_fee ?? DEFAULT_PENALTY_POLICY.dailyFee),
    blockOverdueDays: Number(policy.blockOverdueDays ?? policy.block_overdue_days ?? DEFAULT_PENALTY_POLICY.blockOverdueDays)
  };
  writeJSON(PENALTY_POLICY_KEY, nextPolicy);
};


const toUtcDay = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
};

const todayUtcDay = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

const getOverdueDays = (dueDate) => {
  const dueUtc = toUtcDay(dueDate);
  if (!dueUtc) return 0;
  const diffDays = Math.floor((todayUtcDay() - dueUtc) / 86400000);
  return Math.max(0, diffDays);
};

const getPenaltyAmount = (overdueDays, policy) => {
  const activePolicy = policy || getPenaltyPolicy();
  const chargeableDays = Math.max(0, overdueDays - activePolicy.graceDays);
  return chargeableDays * activePolicy.dailyFee;
};

const getUserEmail = () => {
  const user = getStoredUser() || {};
  return user.email || 'guest';
};

const keyFor = (name) => `${STORAGE_PREFIX}.${getUserEmail()}.${name}`;

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const normalizeBorrowed = (items) => {
  const policy = getPenaltyPolicy();
  return items.map((item) => {
    const overdueDays = getOverdueDays(item.dueDate);
    const status = overdueDays > 0 ? 'overdue' : item.status;
    const penaltyAmount = getPenaltyAmount(overdueDays, policy);
    return {
      ...item,
      status,
      overdueDays,
      penaltyAmount
    };
  });
};

const saveBorrowedData = (items) => {
  const normalized = normalizeBorrowed(items);
  writeJSON(keyFor('borrowed'), normalized);
  return normalized;
};

export const getBooksData = () => {
  const key = keyFor('books');
  const books = readJSON(key, null);
  if (!Array.isArray(books) || books.length === 0) {
    writeJSON(key, DEFAULT_BOOKS);
    return DEFAULT_BOOKS;
  }
  const normalized = books.map((book) => {
    const defaults = DEFAULT_BOOKS_BY_ID[book.id];
    if (!defaults) return book;
    return { ...defaults, ...book };
  });
  writeJSON(key, normalized);
  return normalized;
};

export const setBooksData = (books) => {
  if (!Array.isArray(books) || books.length === 0) return;
  const normalized = books.map((book) => ({
    ...book,
    id: Number(book.id),
    available: Number(book.available ?? book.copies_available ?? 0),
    quantity: Number(book.quantity ?? book.copies_total ?? 0),
    title: String(book.title || ''),
    author: String(book.author || ''),
    category: String(book.category || ''),
    cover: String(book.cover_image_url || book.cover || ''),
    created_at: String(book.created_at || book.createdAt || ''),
    borrow_count: Number(book.borrow_count || book.borrowCount || 0)
  }));
  writeJSON(keyFor('books'), normalized);
};

export const getBorrowedData = () => {
  const borrowed = readJSON(keyFor('borrowed'), []);
  return saveBorrowedData(Array.isArray(borrowed) ? borrowed : []);
};

export const syncBorrowedFromServer = async () => {
  if (!isAuthenticated()) return { success: false, message: 'Not authenticated' };
  try {
    const res = await api.getBorrowedBooks();
    if (!res || !res.success || !Array.isArray(res.data)) {
      return { success: false, message: res?.message || 'Failed to fetch borrowed data' };
    }

    const items = res.data.map((it) => ({
      id: Number(it.id) || Date.now(),
      bookId: Number(it.bookId) || null,
      title: String(it.title || ''),
      borrowDate: String(it.borrowDate || ''),
      dueDate: String(it.dueDate || ''),
      status: String(it.status || 'active')
    }));

    saveBorrowedData(items);
    return { success: true, data: items };
  } catch (error) {
    return { success: false, message: 'Network error' };
  }
};

export const getPenaltySummary = (borrowedItems = getBorrowedData(), policy = getPenaltyPolicy()) => {
  const summary = borrowedItems.reduce(
    (acc, item) => {
      const overdueDays = item.overdueDays ?? getOverdueDays(item.dueDate);
      const penaltyAmount = item.penaltyAmount ?? getPenaltyAmount(overdueDays, policy);
      const maxOverdueDays = Math.max(acc.maxOverdueDays, overdueDays);
      return {
        penaltyDue: acc.penaltyDue + penaltyAmount,
        maxOverdueDays
      };
    },
    { penaltyDue: 0, maxOverdueDays: 0 }
  );

  return {
    ...summary,
    blocked: summary.maxOverdueDays >= policy.blockOverdueDays
  };
};

export const getReturnedData = () => {
  const returned = readJSON(keyFor('returned'), []);
  return Array.isArray(returned) ? returned : [];
};

export const syncReturnedFromServer = async () => {
  if (!isAuthenticated()) return { success: false, message: 'Not authenticated' };
  try {
    const res = await api.getReturnedBooks();
    if (!res || !res.success || !Array.isArray(res.data)) {
      return { success: false, message: res?.message || 'Failed to fetch returned data' };
    }

    const items = res.data.map((it) => ({
      id: Number(it.id) || Date.now(),
      bookId: Number(it.bookId) || null,
      title: String(it.title || ''),
      borrowDate: String(it.borrowDate || ''),
      returnDate: String(it.returnDate || ''),
      status: String(it.status || 'completed'),
      overdueDays: Number(it.overdueDays || 0),
      penaltyAmount: Number(it.penaltyAmount || 0)
    }));

    writeJSON(keyFor('returned'), items);
    return { success: true, data: items };
  } catch (error) {
    return { success: false, message: 'Network error' };
  }
};

export const getNotificationSettings = () => {
  const settings = readJSON(keyFor('notifications'), null);
  if (!settings) {
    writeJSON(keyFor('notifications'), DEFAULT_NOTIFICATIONS);
    return DEFAULT_NOTIFICATIONS;
  }
  return settings;
};

export const setNotificationSettings = (settings) => {
  writeJSON(keyFor('notifications'), settings);
};

const appendActivity = (entry) => {
  const current = readJSON(keyFor('activity'), []);
  const next = [entry, ...current].slice(0, 30);
  writeJSON(keyFor('activity'), next);

  // Also persist activity to server for admin visibility. Do this asynchronously and
  // don't block the local UX if server is unavailable.
  try {
    api.postStudentActivity({
      email: getUserEmail(),
      action: entry.action || 'Activity',
      details: entry.book_title || entry.details || null,
      time: entry.date || entry.time || new Date().toISOString(),
      timestamp: entry.timestamp || Date.now()
    }).catch(() => {});
  } catch (err) {
    // ignore network errors
  }
};

export const getActivityData = () => {
  const activity = readJSON(keyFor('activity'), []);
  return Array.isArray(activity) ? activity : [];
};

export const borrowBookById = async (bookId) => {
  if (!isAuthenticated()) {
    return {
      success: false,
      message: 'Please login or create an account to borrow books.'
    };
  }

  const books = getBooksData();
  const index = books.findIndex((book) => book.id === bookId);
  if (index < 0) {
    return { success: false, message: 'Book not found.' };
  }

  const selectedBook = books[index];
  const apiResult = await api.borrowBook({
    bookId,
    dueDays: 14
  });

  if (!apiResult.success) {
    return { success: false, message: apiResult.message || 'Unable to borrow book.' };
  }

  const borrowed = getBorrowedData();
  const borrowedInfo = apiResult.borrowed || {};
  const fallbackBorrowDate = new Date();
  const fallbackDueDate = new Date(fallbackBorrowDate);
  fallbackDueDate.setDate(fallbackBorrowDate.getDate() + 14);
  const borrowDate = borrowedInfo.borrowDate || formatDate(fallbackBorrowDate);
  const dueDate = borrowedInfo.dueDate || formatDate(fallbackDueDate);
  const newBorrow = {
    id: borrowedInfo.id || Date.now(),
    bookId: borrowedInfo.bookId || selectedBook.id,
    title: borrowedInfo.title || selectedBook.title,
    borrowDate,
    dueDate,
    status: 'active'
  };

  const updatedBooks = [...books];
  const nextAvailable = Number.isFinite(apiResult.available)
    ? apiResult.available
    : Math.max(0, Number(selectedBook.available) - 1);
  updatedBooks[index] = { ...selectedBook, available: nextAvailable };
  writeJSON(keyFor('books'), updatedBooks);

  saveBorrowedData([newBorrow, ...borrowed]);
  appendActivity({
    book_title: newBorrow.title,
    action: 'Borrowed',
    date: borrowDate,
    status: 'Active'
  });

  return { success: true, message: apiResult.message || 'Book borrowed successfully.' };
};

export const returnBorrowedBook = async (borrowId) => {
  const borrowed = getBorrowedData();
  const record = borrowed.find((item) => item.id === borrowId);
  if (!record) {
    return { success: false, message: 'Borrow record not found.' };
  }

  const apiResult = await api.returnBook({
    transactionId: borrowId,
    bookId: record.bookId
  });

  if (!apiResult.success) {
    return { success: false, message: apiResult.message || 'Unable to return book.' };
  }

  const books = getBooksData();
  const index = books.findIndex((book) => book.id === record.bookId);
  if (index >= 0) {
    const updatedBooks = [...books];
    updatedBooks[index] = { ...updatedBooks[index], available: updatedBooks[index].available + 1 };
    writeJSON(keyFor('books'), updatedBooks);
  }

  const remaining = borrowed.filter((item) => item.id !== borrowId);
  saveBorrowedData(remaining);

  const returned = getReturnedData();
  const returnDate = formatDate(new Date());
  const policy = getPenaltyPolicy();
  const overdueDays = Number(apiResult.overdueDays ?? record.overdueDays ?? getOverdueDays(record.dueDate));
  const penaltyAmount = Number(apiResult.penaltyAmount ?? record.penaltyAmount ?? getPenaltyAmount(overdueDays, policy));
  const updatedReturned = [
    {
      id: Date.now(),
      bookId: record.bookId,
      title: record.title,
      borrowDate: record.borrowDate,
      returnDate,
      status: 'completed',
      overdueDays,
      penaltyAmount
    },
    ...returned
  ];
  writeJSON(keyFor('returned'), updatedReturned);

  appendActivity({
    book_title: record.title,
    action: 'Returned',
    date: returnDate,
    status: 'Completed'
  });

  if (penaltyAmount > 0) {
    return {
      success: true,
      message: `Book returned successfully. Late fee: PHP ${penaltyAmount} (${overdueDays} overdue day${overdueDays === 1 ? '' : 's'}).`
    };
  }

  return { success: true, message: 'Book returned successfully.' };
};

export const clearStudentHistory = () => {
  writeJSON(keyFor('returned'), []);
  writeJSON(keyFor('activity'), []);
};
