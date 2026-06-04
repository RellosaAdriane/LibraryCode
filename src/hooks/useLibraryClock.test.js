import { act, renderHook } from '@testing-library/react';
import { api } from '../api';
import { useLibraryClock } from './useLibraryClock';

vi.mock('../api', () => ({
  api: {
    getPhilippineTime: vi.fn(() => Promise.resolve({
      success: true,
      timestamp_ms: Date.parse('2026-06-04T09:00:00+08:00'),
      source: 'google_ntp',
      source_host: 'time.google.com'
    }))
  }
}));

describe('useLibraryClock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('loads Philippine time on mount', async () => {
    const { result } = renderHook(() => useLibraryClock());

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.getPhilippineTime).toHaveBeenCalled();
    expect(result.current.full).toBeTruthy();
    expect(result.current.compact).toBeTruthy();
    expect(result.current.title).toBeTruthy();
  });
});
