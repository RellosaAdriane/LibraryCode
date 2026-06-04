export const emptyForm = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  intro: '',
  quantity: 1
};

export const LOW_STOCK_THRESHOLD = 2;
export const BOOKS_PAGE_SIZE = 10;
export const USERS_PAGE_SIZE = 10;

export const USER_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admins' },
  { value: 'student', label: 'Students' },
  { value: 'staff', label: 'Staff' }
];

export const SESSION_STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active Sessions' },
  { value: 'revoked', label: 'Revoked Sessions' },
  { value: 'all', label: 'All Sessions' }
];

export const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'dashboard' },
  { id: 'announcements', label: 'Announcements', icon: 'bell' },
  { id: 'borrowing', label: 'Borrowing Rules', icon: 'books' },
  { id: 'authentication', label: 'Authentication', icon: 'adminShield' },
  { id: 'sessions', label: 'Sessions & Security', icon: 'activity' }
];
