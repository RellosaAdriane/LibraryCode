import { formatLibraryDate } from '../../utils/libraryTime';

export const filterBorrowRecords = (records, query) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return records;
  return records.filter((record) => (
    String(record.studentName || '').toLowerCase().includes(normalized)
    || String(record.email || '').toLowerCase().includes(normalized)
    || String(record.title || '').toLowerCase().includes(normalized)
  ));
};

export const getBorrowTableContainerClass = (rowCount, loading) => {
  if (loading || rowCount > 4) return 'table-container admin-table-scroll';
  return 'table-container table-container-compact admin-table-scroll';
};

export const isRecordDateToday = (dateValue) => {
  if (!dateValue) return false;
  return String(dateValue).slice(0, 10) === formatLibraryDate();
};

export const getTimeGreeting = () => {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric',
      hour12: false
    }).format(new Date()));
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  } catch {
    return 'Welcome back';
  }
};
