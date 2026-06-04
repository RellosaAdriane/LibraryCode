import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
import StudentHome from './StudentHome';
import { renderStudentPage, seedStudentAuth, studentUser } from './testUtils';

const refreshHandlers = [];

vi.mock('../../api', () => ({
  api: {
    getStudentSummary: vi.fn(),
    getPenaltySettings: vi.fn(),
    getAnnouncementSettings: vi.fn()
  }
}));

vi.mock('../../auth', () => ({
  getStoredUser: vi.fn(),
  isAuthenticated: vi.fn()
}));

vi.mock('./studentStorage', () => ({
  getBooksData: vi.fn(() => [
    { id: 1, title: 'Book A', author: 'Author A', category: 'Science', available: 2 },
    { id: 2, title: 'Book B', author: 'Author B', category: 'History', available: 1 }
  ]),
  getBorrowedData: vi.fn(() => []),
  getReturnedData: vi.fn(() => []),
  getPenaltyPolicy: vi.fn(() => ({
    graceDays: 7,
    dailyFee: 150,
    blockOverdueDays: 14
  })),
  getPenaltySummary: vi.fn(() => ({
    penaltyDue: 0,
    maxOverdueDays: 0,
    blocked: false
  })),
  setPenaltyPolicy: vi.fn()
}));

vi.mock('../../hooks/useLibraryDataRefresh', () => ({
  useLibraryDataRefresh: (callback) => {
    refreshHandlers.push(callback);
  }
}));

import { api } from '../../api';
import { getStoredUser, isAuthenticated } from '../../auth';

describe('StudentHome page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshHandlers.length = 0;
    isAuthenticated.mockReturnValue(false);
    getStoredUser.mockReturnValue(null);
    api.getPenaltySettings.mockResolvedValue({
      success: true,
      settings: { grace_days: 7, daily_fee: 150, block_overdue_days: 14 }
    });
    api.getAnnouncementSettings.mockResolvedValue({
      success: true,
      settings: {
        enabled: true,
        title: 'Library Notice',
        message: 'Welcome to the library.',
        updated_at: '2026-06-04T09:00:00+08:00'
      }
    });
  });

  test('renders guest dashboard copy and catalog stats', async () => {
    renderStudentPage(<StudentHome />);

    await waitFor(() => {
      expect(screen.getByText('Browse the library catalog')).toBeInTheDocument();
      expect(screen.getByText('Book titles')).toBeInTheDocument();
      expect(screen.getByText('Library Notice')).toBeInTheDocument();
    });

    expect(screen.queryByText(/my borrowed books/i)).not.toBeInTheDocument();
  });

  test('renders member dashboard with welcome message and quick links', async () => {
    seedStudentAuth();
    isAuthenticated.mockReturnValue(true);
    getStoredUser.mockReturnValue(studentUser);
    api.getStudentSummary.mockResolvedValue({
      success: true,
      data: {
        totalBooks: 2,
        borrowed: 1,
        returned: 3,
        overdue: 0,
        penaltyDue: 0,
        canBorrow: true
      }
    });

    renderStudentPage(<StudentHome />);

    await waitFor(() => {
      expect(screen.getByText('Your library dashboard')).toBeInTheDocument();
      expect(screen.getByText(/welcome back, casey/i)).toBeInTheDocument();
      expect(screen.getByText('My borrowed books')).toBeInTheDocument();
      expect(screen.getByText('Currently borrowed')).toBeInTheDocument();
    });
  });

  test('shows penalty notice when borrowing is blocked', async () => {
    seedStudentAuth();
    isAuthenticated.mockReturnValue(true);
    getStoredUser.mockReturnValue(studentUser);
    api.getStudentSummary.mockResolvedValue({
      success: true,
      data: {
        totalBooks: 2,
        borrowed: 1,
        returned: 0,
        overdue: 1,
        penaltyDue: 300,
        canBorrow: false
      }
    });

    renderStudentPage(<StudentHome />);

    await waitFor(() => {
      expect(screen.getByText('Penalty notice')).toBeInTheDocument();
      expect(screen.getByText(/borrowing is paused/i)).toBeInTheDocument();
    });
  });

  test('refreshes announcement content when refresh handler runs', async () => {
    api.getAnnouncementSettings
      .mockResolvedValueOnce({
        success: true,
        settings: {
          enabled: true,
          title: 'First Notice',
          message: 'First message',
          updated_at: '2026-06-04T09:00:00+08:00'
        }
      })
      .mockResolvedValueOnce({
        success: true,
        settings: {
          enabled: true,
          title: 'Updated Notice',
          message: 'Updated message',
          updated_at: '2026-06-04T10:00:00+08:00'
        }
      });

    renderStudentPage(<StudentHome />);

    await waitFor(() => {
      expect(screen.getByText('First Notice')).toBeInTheDocument();
    });

    await act(async () => {
      await refreshHandlers[0]?.();
    });

    await waitFor(() => {
      expect(screen.getByText('Updated Notice')).toBeInTheDocument();
    });
  });
});
