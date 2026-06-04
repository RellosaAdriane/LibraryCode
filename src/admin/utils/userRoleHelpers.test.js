import { getRoleBadgeClass, getRoleLabel } from './userRoleHelpers';

describe('userRoleHelpers', () => {
  test('getRoleLabel resolves admin, staff, and student', () => {
    expect(getRoleLabel({ role: 'admin' })).toBe('Admin');
    expect(getRoleLabel({ role: 'student', affiliation: 'staff' })).toBe('Staff');
    expect(getRoleLabel({ role: 'student' })).toBe('Student');
  });

  test('getRoleBadgeClass mirrors role labels', () => {
    expect(getRoleBadgeClass({ role: 'admin' })).toBe('admin');
    expect(getRoleBadgeClass({ role: 'staff' })).toBe('staff');
    expect(getRoleBadgeClass({ role: 'student' })).toBe('student');
  });
});
