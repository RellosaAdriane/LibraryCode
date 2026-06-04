import { act, renderHook } from '@testing-library/react';
import { LIBRARY_DATA_CHANGED_EVENT } from '../utils/libraryDataEvents';
import { useLibraryDataRefresh } from './useLibraryDataRefresh';

describe('useLibraryDataRefresh', () => {
  test('calls the refresh callback when library data changes', async () => {
    const onRefresh = vi.fn();

    renderHook(() => useLibraryDataRefresh(onRefresh));

    await act(async () => {
      window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT, { detail: { source: 'test' } }));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('uses the latest callback reference', async () => {
    const first = vi.fn();
    const second = vi.fn();

    const { rerender } = renderHook(
      ({ callback }) => useLibraryDataRefresh(callback),
      { initialProps: { callback: first } }
    );

    rerender({ callback: second });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(LIBRARY_DATA_CHANGED_EVENT, { detail: { source: 'test' } }));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
