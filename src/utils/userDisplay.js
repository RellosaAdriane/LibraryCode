export const getUserInitials = (user) => {
  const first = String(user?.first_name || '').trim();
  const last = String(user?.last_name || '').trim();
  const initials = `${first.charAt(0) || ''}${last.charAt(0) || ''}`.toUpperCase();
  return initials || '?';
};

export const formatPersonName = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .split(/\s+/)
  .filter(Boolean)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

export const formatDisplayName = (entry) => {
  const fullName = `${formatPersonName(entry?.first_name)} ${formatPersonName(entry?.last_name)}`.trim();
  return fullName || 'Unknown User';
};

export const formatBorrowStudentName = (name) => formatPersonName(name) || '-';

export const formatInstitutionId = (user) => {
  const value = String(user?.institution_id || '').trim();
  return value || 'Not provided';
};
