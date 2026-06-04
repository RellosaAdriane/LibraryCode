import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import { updateStoredUser } from '../../auth';
import { formatLibraryTableDate } from '../../utils/libraryTime';
import { USERS_PAGE_SIZE } from '../constants';
import { getRoleLabel } from '../utils/userRoleHelpers';

export function useAdminUsers({
  user,
  setMessage,
  setConfirmDialog,
  logAction,
  showUserToast,
  securityLogs
}) {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersLoadError, setUsersLoadError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [debouncedUserSearch, setDebouncedUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userRoleSavingId, setUserRoleSavingId] = useState(null);
  const [userSortField, setUserSortField] = useState('joined');
  const [userSortDir, setUserSortDir] = useState('desc');
  const [userPage, setUserPage] = useState(1);
  const [userActionMenu, setUserActionMenu] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [profileSessions, setProfileSessions] = useState([]);
  const [profileSessionsLoading, setProfileSessionsLoading] = useState(false);
  const [profileBorrows, setProfileBorrows] = useState([]);
  const [profileBorrowsLoading, setProfileBorrowsLoading] = useState(false);
  const [profileAdminNotes, setProfileAdminNotes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_user_notes') || '{}');
    } catch {
      return {};
    }
  });

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersLoadError('');
    const result = await api.getUsers({ requesterId: user.id, requesterEmail: user.email });
    if (result.success) {
      setUsers(Array.isArray(result.users) ? result.users : []);
    } else {
      const errorMessage = result.message || 'Failed to load users.';
      setUsersLoadError(errorMessage);
      setMessage(errorMessage);
    }
    setUsersLoading(false);
  }, [user.id, user.email, setMessage]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedUserSearch(userSearch);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [userSearch]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, userRoleFilter, userSortField, userSortDir]);

  useEffect(() => {
    if (!selectedUserProfile?.id) {
      setProfileSessions([]);
      setProfileBorrows([]);
      setProfileTab('overview');
      return undefined;
    }

    let cancelled = false;
    const loadProfileData = async () => {
      setProfileSessionsLoading(true);
      setProfileBorrowsLoading(true);

      const [sessionsResult, borrowsResult] = await Promise.all([
        api.getSessions({
          requesterId: user.id,
          requesterEmail: user.email,
          userId: selectedUserProfile.id,
          includeRevoked: true
        }),
        api.getAdminUserBorrows({
          userId: selectedUserProfile.id,
          requesterId: user.id,
          requesterEmail: user.email
        })
      ]);

      if (!cancelled) {
        setProfileSessions(Array.isArray(sessionsResult.sessions) ? sessionsResult.sessions : []);
        setProfileBorrows(Array.isArray(borrowsResult.borrows) ? borrowsResult.borrows : []);
        setProfileSessionsLoading(false);
        setProfileBorrowsLoading(false);
      }
    };

    loadProfileData();
    return () => {
      cancelled = true;
    };
  }, [selectedUserProfile, user.id, user.email]);

  useEffect(() => {
    if (!userActionMenu) return undefined;

    const handleClose = () => setUserActionMenu(null);
    const handleEscape = (event) => {
      if (event.key === 'Escape') handleClose();
    };

    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, [userActionMenu]);

  const filteredUsers = useMemo(() => {
    const query = debouncedUserSearch.trim().toLowerCase();
    return users.filter((entry) => {
      const matchesQuery = !query || (
        String(entry.first_name || '').toLowerCase().includes(query) ||
        String(entry.last_name || '').toLowerCase().includes(query) ||
        String(entry.email || '').toLowerCase().includes(query) ||
        String(entry.institution_id || '').toLowerCase().includes(query)
      );
      if (!matchesQuery) return false;
      if (userRoleFilter === 'admin') return entry.role === 'admin';
      if (userRoleFilter === 'student') return entry.role === 'student';
      if (userRoleFilter === 'staff') {
        return entry.affiliation === 'staff' || entry.role === 'staff';
      }
      return true;
    });
  }, [users, debouncedUserSearch, userRoleFilter]);

  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    const direction = userSortDir === 'asc' ? 1 : -1;

    sorted.sort((left, right) => {
      if (userSortField === 'name') {
        const leftName = `${left.first_name || ''} ${left.last_name || ''}`.trim();
        const rightName = `${right.first_name || ''} ${right.last_name || ''}`.trim();
        return leftName.localeCompare(rightName) * direction;
      }

      if (userSortField === 'role') {
        return getRoleLabel(left).localeCompare(getRoleLabel(right)) * direction;
      }

      if (userSortField === 'affiliation') {
        return String(left.affiliation || '').localeCompare(String(right.affiliation || '')) * direction;
      }

      const leftJoined = Date.parse(left.created_at || '') || 0;
      const rightJoined = Date.parse(right.created_at || '') || 0;
      return (leftJoined - rightJoined) * direction;
    });

    return sorted;
  }, [filteredUsers, userSortField, userSortDir]);

  const userPageCount = Math.max(1, Math.ceil(sortedUsers.length / USERS_PAGE_SIZE));
  const currentUserPage = Math.min(userPage, userPageCount);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentUserPage - 1) * USERS_PAGE_SIZE;
    return sortedUsers.slice(startIndex, startIndex + USERS_PAGE_SIZE);
  }, [sortedUsers, currentUserPage]);
  const userPageStart = sortedUsers.length === 0 ? 0 : ((currentUserPage - 1) * USERS_PAGE_SIZE) + 1;
  const userPageEnd = Math.min(currentUserPage * USERS_PAGE_SIZE, sortedUsers.length);

  const userStats = useMemo(() => {
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const joinedThisWeek = users.filter((entry) => {
      const joinedAt = Date.parse(entry.created_at || '');
      return !Number.isNaN(joinedAt) && joinedAt >= weekAgo;
    }).length;

    const students = users.filter((entry) => entry.role === 'student');
    const admins = users.filter((entry) => entry.role === 'admin');
    const staff = users.filter((entry) => (
      entry.affiliation === 'staff' || entry.role === 'staff'
    ));

    return {
      total: users.length,
      students: students.length,
      admins: admins.length,
      staff: staff.length,
      joinedThisWeek,
      newStudentsThisWeek: students.filter((entry) => {
        const joinedAt = Date.parse(entry.created_at || '');
        return !Number.isNaN(joinedAt) && joinedAt >= weekAgo;
      }).length
    };
  }, [users]);

  const profileUserActivity = useMemo(() => {
    if (!selectedUserProfile?.id) return [];
    const targetId = Number(selectedUserProfile.id);
    return securityLogs.filter((entry) => {
      const details = entry.details || {};
      return Number(details.target_user_id) === targetId;
    }).slice(0, 8);
  }, [securityLogs, selectedUserProfile]);

  const formatUserDate = (value) => formatLibraryTableDate(value);

  const toggleUserSort = (field) => {
    if (userSortField === field) {
      setUserSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setUserSortField(field);
    setUserSortDir(field === 'name' ? 'asc' : 'desc');
  };

  const openUserProfile = (entry) => {
    setSelectedUserProfile(entry);
    setProfileTab('overview');
    setUserActionMenu(null);
  };

  const openUserActionMenu = (event, entry) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 300;
    const openUpward = rect.bottom + menuHeight > window.innerHeight - 16;

    setUserActionMenu({
      entry,
      top: openUpward ? rect.top - menuHeight - 8 : rect.bottom + 8,
      left: Math.min(window.innerWidth - menuWidth - 12, Math.max(12, rect.right - menuWidth))
    });
  };

  const saveProfileAdminNote = (userId, note) => {
    setProfileAdminNotes((prev) => {
      const next = { ...prev, [userId]: note };
      sessionStorage.setItem('admin_user_notes', JSON.stringify(next));
      return next;
    });
  };

  const requestPendingAdminAction = (title, message) => {
    setConfirmDialog({
      title,
      message,
      confirmLabel: 'Confirm',
      onConfirm: () => {
        setConfirmDialog(null);
        showUserToast('This action is not available yet.', true);
      }
    });
  };

  const applyUserRoleFilter = (filterValue) => {
    setUserRoleFilter(filterValue);
    setUserPage(1);
  };

  const requestRoleChange = (targetUser, nextRole) => {
    if (!targetUser || targetUser.role === nextRole || userRoleSavingId) return;

    const isSelf = Number(targetUser.id) === Number(user.id || 0);
    const warning = isSelf && nextRole !== 'admin'
      ? 'You are about to remove your own admin access. You may lose access to the admin dashboard.'
      : `Update ${targetUser.email}'s role to ${nextRole}?`;

    setConfirmDialog({
      title: isSelf && nextRole !== 'admin' ? 'Remove your admin access?' : 'Confirm role change',
      message: warning,
      confirmLabel: 'Confirm',
      onConfirm: async () => {
        setConfirmDialog(null);
        setUserRoleSavingId(targetUser.id);
        const result = await api.updateUserRole({
          id: targetUser.id,
          role: nextRole,
          requester_id: user.id,
          requester_email: user.email
        });
        setUserRoleSavingId(null);

        if (result.success) {
          setUsers((prev) => prev.map((entry) => (
            Number(entry.id) === Number(targetUser.id) ? { ...entry, role: nextRole } : entry
          )));
          logAction('User Role Updated', `${targetUser.email} -> ${nextRole}`);
          showUserToast(`User role updated to ${nextRole}.`);
          if (isSelf) {
            updateStoredUser({ role: nextRole });
          }
        } else {
          showUserToast(result.message || 'Failed to update role.', true);
        }
      }
    });
  };

  return {
    users,
    setUsers,
    usersLoading,
    usersLoadError,
    userSearch,
    setUserSearch,
    debouncedUserSearch,
    userRoleFilter,
    setUserRoleFilter,
    userRoleSavingId,
    userSortField,
    setUserSortField,
    userSortDir,
    setUserSortDir,
    userPage,
    setUserPage,
    userActionMenu,
    setUserActionMenu,
    selectedUserProfile,
    setSelectedUserProfile,
    profileTab,
    setProfileTab,
    profileSessions,
    profileSessionsLoading,
    profileBorrows,
    profileBorrowsLoading,
    profileAdminNotes,
    loadUsers,
    filteredUsers,
    sortedUsers,
    userPageCount,
    currentUserPage,
    paginatedUsers,
    userPageStart,
    userPageEnd,
    userStats,
    profileUserActivity,
    formatUserDate,
    toggleUserSort,
    openUserProfile,
    openUserActionMenu,
    saveProfileAdminNote,
    requestPendingAdminAction,
    applyUserRoleFilter,
    requestRoleChange
  };
}
