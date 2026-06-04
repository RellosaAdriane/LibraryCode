export const getRoleBadgeClass = (entry) => {
  const role = String(entry?.role || '').toLowerCase();
  const affiliation = String(entry?.affiliation || '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (affiliation === 'staff' || role === 'staff') return 'staff';
  return 'student';
};

export const getRoleLabel = (entry) => {
  const role = String(entry?.role || '').toLowerCase();
  const affiliation = String(entry?.affiliation || '').toLowerCase();
  if (role === 'admin') return 'Admin';
  if (affiliation === 'staff' || role === 'staff') return 'Staff';
  return 'Student';
};
