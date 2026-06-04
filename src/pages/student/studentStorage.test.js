import {
  getBooksData,
  setBooksData,
  getBorrowedData,
  getReturnedData,
  getPenaltyPolicy,
  getPenaltySummary,
  syncBooksFromServer,
  syncBorrowedFromServer,
  syncReturnedFromServer,
  refreshSharedStudentData,
  borrowBookById,
  returnBorrowedBook
} from './studentStorage';
import { LIBRARY_DATA_CHANGED_EVENT } from '../../utils/libraryDataEvents';

vi.mock('../../api', () => ({
  api: {
    getBooks: vi.fn(),
    getBorrowedBooks: vi.fn(),
    getReturnedBooks: vi.fn(),
    getPenaltySettings: vi.fn(),
    getMyStudentActivities: vi.fn(),
    borrowBook: vi.fn(),
    returnBook: vi.fn(),
    postStudentActivity: vi.fn(() => Promise.resolve({ success: true }))
  }
}));

import { api } from '../../api';

const studentUser = {
  id: 7,
  email: 'student.unit@test.com',
  first_name: 'Unit',
  last_name: 'Student',
  role: 'student',
  session_id: 'sess_unit_test'
};

function seedAuthUser() {
  sessionStorage.setItem('user', JSON.stringify(studentUser));
}

describe('studentStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  test('getBooksData seeds defaults when storage is empty', () => {
    seedAuthUser();
    const books = getBooksData();

    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBeGreaterThan(0);
    expect(books[0]).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      available: expect.any(Number)
    });
  });

  test('setBooksData normalizes and persists book records', () => {
    seedAuthUser();
    setBooksData([
      {
        id: 99,
        title: 'Test Book',
        author: 'Author',
        category: 'Testing',
        copies_available: 2,
        copies_total: 5,
        cover_image_url: '/uploads/book-covers/test.png'
      }
    ]);

    const books = getBooksData();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id: 99,
      title: 'Test Book',
      available: 2,
      quantity: 5
    });
  });

  test('syncBooksFromServer stores books from API', async () => {
    seedAuthUser();
    api.getBooks.mockResolvedValueOnce({
      success: true,
      books: [{ id: 5, title: 'Synced Book', author: 'A', category: 'C', copies_available: 1, copies_total: 1 }]
    });

    const result = await syncBooksFromServer();

    expect(result.success).toBe(true);
    expect(getBooksData()[0].title).toBe('Synced Book');
  });

  test('syncBorrowedFromServer requires authentication', async () => {
    const result = await syncBorrowedFromServer();
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/authenticated/i);
  });

  test('syncBorrowedFromServer stores active loans', async () => {
    seedAuthUser();
    api.getBorrowedBooks.mockResolvedValueOnce({
      success: true,
      data: [{
        id: 10,
        bookId: 5,
        title: 'Loaned Book',
        borrowDate: 'Jun 01, 2026',
        dueDate: 'Jun 15, 2026',
        status: 'active'
      }]
    });

    const result = await syncBorrowedFromServer();

    expect(result.success).toBe(true);
    expect(getBorrowedData()).toHaveLength(1);
    expect(getBorrowedData()[0].title).toBe('Loaned Book');
  });

  test('syncReturnedFromServer stores completed returns', async () => {
    seedAuthUser();
    api.getReturnedBooks.mockResolvedValueOnce({
      success: true,
      data: [{
        id: 11,
        bookId: 5,
        title: 'Returned Book',
        borrowDate: 'May 01, 2026',
        returnDate: 'May 15, 2026',
        status: 'completed',
        overdueDays: 0,
        penaltyAmount: 0
      }]
    });

    const result = await syncReturnedFromServer();

    expect(result.success).toBe(true);
    expect(getReturnedData()).toHaveLength(1);
    expect(getReturnedData()[0].title).toBe('Returned Book');
  });

  test('refreshSharedStudentData syncs books and authenticated collections', async () => {
    seedAuthUser();
    api.getBooks.mockResolvedValueOnce({ success: true, books: [{ id: 1, title: 'A', author: 'B', category: 'C', copies_available: 1, copies_total: 1 }] });
    api.getBorrowedBooks.mockResolvedValueOnce({ success: true, data: [] });
    api.getReturnedBooks.mockResolvedValueOnce({ success: true, data: [] });
    api.getMyStudentActivities.mockResolvedValueOnce({ success: true, activities: [] });
    api.getPenaltySettings.mockResolvedValueOnce({
      success: true,
      settings: { grace_days: 7, daily_fee: 150, block_overdue_days: 14 }
    });

    const result = await refreshSharedStudentData(true);

    expect(result.success).toBe(true);
    expect(api.getBooks).toHaveBeenCalled();
    expect(api.getBorrowedBooks).toHaveBeenCalled();
    expect(api.getReturnedBooks).toHaveBeenCalled();
    expect(api.getPenaltySettings).toHaveBeenCalled();
  });

  test('getPenaltySummary calculates blocked state from overdue loans', () => {
    const policy = { ...getPenaltyPolicy(), blockOverdueDays: 3 };
    const summary = getPenaltySummary([
      { dueDate: '1999-01-01', overdueDays: 5, penaltyAmount: 300 }
    ], policy);

    expect(summary.penaltyDue).toBe(300);
    expect(summary.maxOverdueDays).toBe(5);
    expect(summary.blocked).toBe(true);
  });

  test('borrowBookById updates local books and borrowed lists', async () => {
    seedAuthUser();
    setBooksData([{ id: 3, title: 'Borrow Me', author: 'A', category: 'C', available: 2, quantity: 2 }]);

    api.borrowBook.mockResolvedValueOnce({
      success: true,
      message: 'Borrowed',
      available: 1,
      borrowed: {
        id: 100,
        bookId: 3,
        title: 'Borrow Me',
        borrowDate: 'Jun 04, 2026',
        dueDate: 'Jun 18, 2026'
      }
    });

    const handler = vi.fn();
    window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);

    const result = await borrowBookById(3);

    expect(result.success).toBe(true);
    expect(getBorrowedData()).toHaveLength(1);
    expect(getBooksData()[0].available).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);
  });

  test('returnBorrowedBook removes active loan and appends returned history', async () => {
    seedAuthUser();
    setBooksData([{ id: 3, title: 'Return Me', author: 'A', category: 'C', available: 1, quantity: 2 }]);
    localStorage.setItem(
      'library.student.student.unit@test.com.borrowed',
      JSON.stringify([{
        id: 100,
        bookId: 3,
        title: 'Return Me',
        borrowDate: 'Jun 01, 2026',
        dueDate: 'Jun 15, 2026',
        status: 'active',
        overdueDays: 0,
        penaltyAmount: 0
      }])
    );

    api.returnBook.mockResolvedValueOnce({
      success: true,
      returnDate: 'Jun 04, 2026',
      overdueDays: 0,
      penaltyAmount: 0
    });

    const handler = vi.fn();
    window.addEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);

    const result = await returnBorrowedBook(100);

    expect(result.success).toBe(true);
    expect(getBorrowedData()).toHaveLength(0);
    expect(getReturnedData()).toHaveLength(1);
    expect(getBooksData()[0].available).toBe(2);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(LIBRARY_DATA_CHANGED_EVENT, handler);
  });
});
