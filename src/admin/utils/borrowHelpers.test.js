import { formatLibraryDate } from '../../utils/libraryTime';
import {
  filterBorrowRecords,
  getBorrowTableContainerClass,
  getTimeGreeting,
  isRecordDateToday
} from './borrowHelpers';

describe('borrowHelpers', () => {
  const records = [
    { studentName: 'Ana Lim', email: 'ana@cvsu.edu.ph', title: 'Clean Code' },
    { studentName: 'Ben Cruz', email: 'ben@cvsu.edu.ph', title: 'Design Patterns' }
  ];

  test('filterBorrowRecords matches student, email, or title', () => {
    expect(filterBorrowRecords(records, 'ana')).toHaveLength(1);
    expect(filterBorrowRecords(records, 'design')).toHaveLength(1);
    expect(filterBorrowRecords(records, '')).toHaveLength(2);
  });

  test('isRecordDateToday compares date prefix to library today', () => {
    const today = formatLibraryDate();
    expect(isRecordDateToday(`${today}T10:00:00+08:00`)).toBe(true);
    expect(isRecordDateToday('1999-01-01')).toBe(false);
  });

  test('getBorrowTableContainerClass switches layout by row count', () => {
    expect(getBorrowTableContainerClass(2, false)).toContain('table-container-compact');
    expect(getBorrowTableContainerClass(8, false)).toContain('admin-table-scroll');
    expect(getBorrowTableContainerClass(2, true)).toContain('admin-table-scroll');
  });

  test('getTimeGreeting returns a friendly label', () => {
    expect(['Good morning', 'Good afternoon', 'Good evening', 'Welcome back']).toContain(getTimeGreeting());
  });
});
