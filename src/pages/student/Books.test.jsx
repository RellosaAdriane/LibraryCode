import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import Books from './Books';
import { renderStudentPage, seedStudentAuth } from './testUtils';

const refreshHandlers = [];

vi.mock('../../api', () => ({
  api: {
    getBooks: vi.fn(),
    getPenaltySettings: vi.fn(),
    getStudentCollection: vi.fn()
  }
}));

vi.mock('../../auth', () => ({
  isAuthenticated: vi.fn(() => false)
}));

vi.mock('./studentStorage', () => ({
  getBooksData: vi.fn(() => []),
  setBooksData: vi.fn(),
  getBorrowedData: vi.fn(() => []),
  getPenaltyPolicy: vi.fn(() => ({
    graceDays: 7,
    dailyFee: 150,
    blockOverdueDays: 14
  })),
  setPenaltyPolicy: vi.fn()
}));

vi.mock('../../hooks/useLibraryDataRefresh', () => ({
  useLibraryDataRefresh: (callback) => {
    refreshHandlers.push(callback);
  }
}));

import { api } from '../../api';
import { isAuthenticated } from '../../auth';
import { getBooksData, setBooksData } from './studentStorage';

const sampleBooks = [
  {
    id: 1,
    title: 'Clean Code',
    author: 'Robert Martin',
    category: 'Programming',
    available: 2,
    quantity: 3,
    cover: '/book-covers/clean-code.svg'
  },
  {
    id: 2,
    title: 'Design Patterns',
    author: 'GoF',
    category: 'Programming',
    available: 0,
    quantity: 1,
    cover: '/book-covers/design-patterns.svg'
  }
];

describe('Books page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshHandlers.length = 0;
    isAuthenticated.mockReturnValue(false);
    api.getBooks.mockResolvedValue({ success: true, books: sampleBooks });
    api.getPenaltySettings.mockResolvedValue({
      success: true,
      settings: { grace_days: 7, daily_fee: 150, block_overdue_days: 14 }
    });
    getBooksData.mockReturnValue(sampleBooks);
    setBooksData.mockImplementation((books) => {
      getBooksData.mockReturnValue(books);
    });
  });

  test('renders catalog books after loading', async () => {
    renderStudentPage(<Books />);

    await waitFor(() => {
      expect(screen.getByText('Clean Code')).toBeInTheDocument();
      expect(screen.getByText('Design Patterns')).toBeInTheDocument();
    });

    expect(setBooksData).toHaveBeenCalled();
    expect(screen.getByText(/showing 2 of 2 books/i)).toBeInTheDocument();
  });

  test('filters books by search query', async () => {
    renderStudentPage(<Books />);

    await waitFor(() => {
      expect(screen.getByText('Clean Code')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by title, author, or category/i), {
      target: { value: 'design' }
    });

    expect(screen.queryByText('Clean Code')).not.toBeInTheDocument();
    expect(screen.getByText('Design Patterns')).toBeInTheDocument();
  });

  test('loads student collection when authenticated', async () => {
    seedStudentAuth();
    isAuthenticated.mockReturnValue(true);
    api.getStudentCollection.mockResolvedValue({
      success: true,
      data: { favorite: [1], notify: [] }
    });

    renderStudentPage(<Books />);

    await waitFor(() => {
      expect(api.getStudentCollection).toHaveBeenCalled();
    });
  });

  test('reloads catalog when refresh handler runs', async () => {
    renderStudentPage(<Books />);

    await waitFor(() => {
      expect(api.getBooks).toHaveBeenCalledTimes(1);
    });

    api.getBooks.mockResolvedValueOnce({
      success: true,
      books: [
        ...sampleBooks,
        {
          id: 3,
          title: 'New Arrival',
          author: 'New Author',
          category: 'Science',
          available: 4,
          quantity: 4,
          cover: '/book-covers/new.svg'
        }
      ]
    });

    await act(async () => {
      await refreshHandlers[0]?.();
    });

    await waitFor(() => {
      expect(api.getBooks).toHaveBeenCalledTimes(2);
      expect(screen.getByText('New Arrival')).toBeInTheDocument();
    });
  });
});
