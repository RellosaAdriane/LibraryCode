import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import Returned from './Returned';
import { renderStudentPage } from './testUtils';

const refreshHandlers = [];

vi.mock('./studentStorage', () => ({
  syncReturnedFromServer: vi.fn(() => Promise.resolve({ success: true })),
  getReturnedData: vi.fn(() => [])
}));

vi.mock('../../hooks/useLibraryDataRefresh', () => ({
  useLibraryDataRefresh: (callback) => {
    refreshHandlers.push(callback);
  }
}));

import { getReturnedData, syncReturnedFromServer } from './studentStorage';

describe('Returned page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshHandlers.length = 0;
    getReturnedData.mockReturnValue([]);
    syncReturnedFromServer.mockResolvedValue({ success: true });
  });

  test('renders returned books after loading', async () => {
    getReturnedData.mockReturnValue([
      {
        id: 1,
        title: 'Completed Book',
        borrowDate: 'May 01, 2026',
        returnDate: 'May 15, 2026',
        status: 'completed'
      }
    ]);

    renderStudentPage(<Returned />);

    await waitFor(() => {
      expect(screen.getByText('Completed Book')).toBeInTheDocument();
      expect(screen.getByText('Returned')).toBeInTheDocument();
    });
  });

  test('shows empty state when there are no returned books', async () => {
    renderStudentPage(<Returned />);

    await waitFor(() => {
      expect(screen.getByText(/no returned books found/i)).toBeInTheDocument();
    });
  });

  test('shows load error when sync fails', async () => {
    syncReturnedFromServer.mockResolvedValueOnce({
      success: false,
      message: 'Unable to load returned books from the server.'
    });

    renderStudentPage(<Returned />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to load returned books/i);
    });
  });

  test('filters returned books by search query', async () => {
    getReturnedData.mockReturnValue([
      {
        id: 1,
        title: 'History of Computing',
        borrowDate: 'Apr 01, 2026',
        returnDate: 'Apr 15, 2026',
        status: 'completed'
      },
      {
        id: 2,
        title: 'Modern Networks',
        borrowDate: 'Apr 02, 2026',
        returnDate: 'Apr 16, 2026',
        status: 'completed'
      }
    ]);

    renderStudentPage(<Returned />);

    await waitFor(() => {
      expect(screen.getByText('History of Computing')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search returned books/i);
    fireEvent.change(input, { target: { value: 'networks' } });

    expect(screen.queryByText('History of Computing')).not.toBeInTheDocument();
    expect(screen.getByText('Modern Networks')).toBeInTheDocument();
  });

  test('reloads when library data changes', async () => {
    renderStudentPage(<Returned />);

    await waitFor(() => {
      expect(syncReturnedFromServer).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await refreshHandlers[0]?.();
    });

    await waitFor(() => {
      expect(syncReturnedFromServer).toHaveBeenCalledTimes(2);
    });
  });
});
