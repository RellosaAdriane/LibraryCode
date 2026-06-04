import { act, renderHook } from '@testing-library/react';
import { api } from '../../api';
import { useAdminBooks } from './useAdminBooks';
import { createHookDeps } from './testUtils';

vi.mock('../../api', () => ({
  api: {
    getBooks: vi.fn(),
    addBook: vi.fn(),
    updateBook: vi.fn(),
    archiveBook: vi.fn(),
    generateBookQr: vi.fn(),
    uploadBookCover: vi.fn(),
    uploadBookQr: vi.fn()
  }
}));

const sampleBooks = [
  { id: 1, title: 'Alpha', author: 'Ann', isbn: '111', category: 'CS', quantity: 5, available: 1 },
  { id: 2, title: 'Beta', author: 'Bob', isbn: '222', category: 'Math', quantity: 3, available: 0 },
  { id: 3, title: 'Gamma', author: 'Gina', isbn: '333', category: 'CS', quantity: 8, available: 8 }
];

describe('useAdminBooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getBooks.mockResolvedValue({ success: true, books: sampleBooks });
  });

  test('loadBooks computes summary and category breakdown', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminBooks(deps));

    await act(async () => {
      await result.current.loadBooks();
    });

    expect(result.current.summary).toMatchObject({
      totalTitles: 3,
      totalCopies: 16,
      availableCopies: 9,
      lowStock: 1,
      outOfStock: 1
    });
    expect(result.current.categorySummary[0][0]).toBe('CS');
    expect(result.current.lowStockBooks).toHaveLength(1);
    expect(deps.setMessage).toHaveBeenCalledWith('');
  });

  test('filters books by search query and stock filter', async () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminBooks(deps));

    await act(async () => {
      await result.current.loadBooks();
    });

    act(() => result.current.setSearchQuery('beta'));
    expect(result.current.filteredBooks).toHaveLength(1);

    act(() => {
      result.current.setSearchQuery('');
      result.current.setStockFilter('out');
    });
    expect(result.current.filteredBooks).toHaveLength(1);
    expect(result.current.filteredBooks[0].title).toBe('Beta');
  });

  test('handleQuickAddBook opens the form on the books section', () => {
    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminBooks(deps));

    act(() => result.current.handleQuickAddBook());

    expect(deps.setActiveSection).toHaveBeenCalledWith('books');
    expect(result.current.formVisible).toBe(true);
    expect(result.current.editingId).toBeNull();
  });

  test('resets book page when filters change', async () => {
    const manyBooks = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      title: `Book ${index + 1}`,
      author: 'Author',
      quantity: 1,
      available: 1,
      category: 'General'
    }));
    api.getBooks.mockResolvedValueOnce({ success: true, books: manyBooks });

    const deps = createHookDeps();
    const { result } = renderHook(() => useAdminBooks(deps));

    await act(async () => {
      await result.current.loadBooks();
    });

    act(() => result.current.setBookPage(2));
    expect(result.current.currentBookPage).toBe(2);

    act(() => result.current.setSearchQuery('Book 1'));
    expect(result.current.currentBookPage).toBe(1);
  });
});
