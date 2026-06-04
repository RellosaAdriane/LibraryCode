import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import Borrowed from './Borrowed';
import { renderStudentPage } from './testUtils';

const refreshHandlers = [];

vi.mock('./studentStorage', () => ({
  syncBorrowedFromServer: vi.fn(() => Promise.resolve({ success: true })),
  getBorrowedData: vi.fn(() => []),
  returnBorrowedBook: vi.fn(() => Promise.resolve({ success: true, message: 'Book returned successfully.' }))
}));

vi.mock('../../hooks/useLibraryDataRefresh', () => ({
  useLibraryDataRefresh: (callback) => {
    refreshHandlers.push(callback);
  }
}));

import {
  getBorrowedData,
  returnBorrowedBook,
  syncBorrowedFromServer
} from './studentStorage';

describe('Borrowed page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshHandlers.length = 0;
    getBorrowedData.mockReturnValue([]);
    syncBorrowedFromServer.mockResolvedValue({ success: true });
  });

  test('renders borrowed books after loading', async () => {
    getBorrowedData.mockReturnValue([
      {
        id: 1,
        bookId: 10,
        title: 'Algorithms Guide',
        borrowDate: 'Jun 01, 2026',
        dueDate: 'Jun 15, 2026',
        status: 'active',
        overdueDays: 0,
        penaltyAmount: 0
      }
    ]);

    renderStudentPage(<Borrowed />);

    await waitFor(() => {
      expect(screen.getByText('Algorithms Guide')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Return' })).toBeInTheDocument();
    expect(syncBorrowedFromServer).toHaveBeenCalled();
  });

  test('shows empty state when there are no borrowed books', async () => {
    renderStudentPage(<Borrowed />);

    await waitFor(() => {
      expect(screen.getByText(/no books currently on loan/i)).toBeInTheDocument();
    });
  });

  test('filters borrowed books by search query', async () => {
    getBorrowedData.mockReturnValue([
      {
        id: 1,
        title: 'Algorithms Guide',
        borrowDate: 'Jun 01, 2026',
        dueDate: 'Jun 15, 2026',
        status: 'active',
        overdueDays: 0,
        penaltyAmount: 0
      },
      {
        id: 2,
        title: 'Design Patterns',
        borrowDate: 'Jun 02, 2026',
        dueDate: 'Jun 16, 2026',
        status: 'active',
        overdueDays: 0,
        penaltyAmount: 0
      }
    ]);

    renderStudentPage(<Borrowed />);

    await waitFor(() => {
      expect(screen.getByText('Algorithms Guide')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/search borrowed books/i), {
      target: { value: 'design' }
    });

    expect(screen.queryByText('Algorithms Guide')).not.toBeInTheDocument();
    expect(screen.getByText('Design Patterns')).toBeInTheDocument();
  });

  test('returns a book and shows the success message', async () => {
    getBorrowedData
      .mockReturnValueOnce([
        {
          id: 42,
          bookId: 10,
          title: 'Return Me',
          borrowDate: 'Jun 01, 2026',
          dueDate: 'Jun 15, 2026',
          status: 'active',
          overdueDays: 0,
          penaltyAmount: 0
        }
      ])
      .mockReturnValue([]);

    renderStudentPage(<Borrowed />);

    await waitFor(() => {
      expect(screen.getByText('Return Me')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Return' }));

    await waitFor(() => {
      expect(returnBorrowedBook).toHaveBeenCalledWith(42);
      expect(screen.getByText('Book returned successfully.')).toBeInTheDocument();
    });
  });

  test('reloads when refresh handler runs', async () => {
    renderStudentPage(<Borrowed />);

    await waitFor(() => {
      expect(syncBorrowedFromServer).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await refreshHandlers[0]?.();
    });

    await waitFor(() => {
      expect(syncBorrowedFromServer).toHaveBeenCalledTimes(2);
    });
  });
});
