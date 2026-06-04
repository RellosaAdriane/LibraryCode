import {
  formatLibraryDate,
  formatLibraryRelativeTime,
  formatLibraryTableDate,
  parseLibraryTimestamp
} from './libraryTime';

describe('libraryTime helpers', () => {
  test('parseLibraryTimestamp treats date-only strings as Manila noon', () => {
    const parsed = parseLibraryTimestamp('2026-06-03');
    expect(Number.isNaN(parsed)).toBe(false);
    expect(new Date(parsed).getUTCHours()).toBe(4);
  });

  test('formatLibraryRelativeTime returns friendly buckets', () => {
    const now = Date.parse('2026-06-03T12:00:00+08:00');
    expect(formatLibraryRelativeTime('2026-06-03T11:59:30+08:00', now)).toBe('Just now');
    expect(formatLibraryRelativeTime('2026-06-03T11:00:00+08:00', now)).toBe('1 hour ago');
  });

  test('formatLibraryTableDate formats valid timestamps', () => {
    const value = formatLibraryTableDate('2026-06-03T10:00:00+08:00');
    expect(value).toMatch(/Jun/);
    expect(value).toMatch(/2026/);
  });

  test('formatLibraryDate returns YYYY-MM-DD shape', () => {
    expect(formatLibraryDate(new Date('2026-06-03T00:00:00+08:00'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
