import {
  formatBorrowStudentName,
  formatDisplayName,
  formatInstitutionId,
  formatPersonName,
  getUserInitials
} from './userDisplay';

describe('userDisplay helpers', () => {
  test('getUserInitials uses first letters of names', () => {
    expect(getUserInitials({ first_name: 'Jane', last_name: 'Doe' })).toBe('JD');
    expect(getUserInitials({})).toBe('?');
  });

  test('formatPersonName title-cases words', () => {
    expect(formatPersonName('juan dela cruz')).toBe('Juan Dela Cruz');
  });

  test('formatDisplayName joins first and last names', () => {
    expect(formatDisplayName({ first_name: 'maria', last_name: 'santos' })).toBe('Maria Santos');
    expect(formatDisplayName(null)).toBe('Unknown User');
  });

  test('formatBorrowStudentName falls back to dash', () => {
    expect(formatBorrowStudentName('ana lim')).toBe('Ana Lim');
    expect(formatBorrowStudentName('')).toBe('-');
  });

  test('formatInstitutionId handles missing values', () => {
    expect(formatInstitutionId({ institution_id: 'ABC123' })).toBe('ABC123');
    expect(formatInstitutionId({})).toBe('Not provided');
  });
});
