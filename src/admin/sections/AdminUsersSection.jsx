import React from 'react';
import { formatDisplayName, getUserInitials } from '../../utils/userDisplay';
import AdminNavIcon from '../components/AdminNavIcon';
import SortableHeader from '../components/SortableHeader';
import UserRoleIcon from '../components/UserRoleIcon';
import UsersRoleSelect from '../components/UsersRoleSelect';
import { getRoleBadgeClass, getRoleLabel } from '../utils/userRoleHelpers';

const AdminUsersSection = ({ admin }) => {
  const {
    userRoleFilter, applyUserRoleFilter, userStats, userSearch, setUserSearch,
    usersLoadError, usersLoading, sortedUsers, paginatedUsers, userSortField, userSortDir,
    toggleUserSort, loadUsers, user, openUserProfile, userActionMenu, openUserActionMenu,
    userRoleSavingId, formatUserDate, userPageStart, userPageEnd, currentUserPage,
    userPageCount, setUserPage
  } = admin;

  return (
    <>
      <div className="users-stats-grid">
        <button
          type="button"
          className={`users-stat-card total ${userRoleFilter === 'all' ? 'is-active' : ''}`}
          onClick={() => applyUserRoleFilter('all')}
        >
          <div className="users-stat-icon" aria-hidden="true"><AdminNavIcon name="users" /></div>
          <div className="users-stat-body">
            <span className="users-stat-label">Total Users</span>
            <strong className="users-stat-value">{userStats.total}</strong>
            <span className="users-stat-meta">
              {userStats.joinedThisWeek > 0 ? `+${userStats.joinedThisWeek} this week` : 'Active accounts'}
            </span>
          </div>
        </button>
        <button
          type="button"
          className={`users-stat-card students ${userRoleFilter === 'student' ? 'is-active' : ''}`}
          onClick={() => applyUserRoleFilter('student')}
        >
          <div className="users-stat-icon" aria-hidden="true"><AdminNavIcon name="studentCap" /></div>
          <div className="users-stat-body">
            <span className="users-stat-label">Students</span>
            <strong className="users-stat-value">{userStats.students}</strong>
            <span className="users-stat-meta">
              {userStats.newStudentsThisWeek > 0
                ? `+${userStats.newStudentsThisWeek} new this week`
                : 'Registered borrowers'}
            </span>
          </div>
        </button>
        <button
          type="button"
          className={`users-stat-card admins ${userRoleFilter === 'admin' ? 'is-active' : ''}`}
          onClick={() => applyUserRoleFilter('admin')}
        >
          <div className="users-stat-icon" aria-hidden="true"><AdminNavIcon name="adminShield" /></div>
          <div className="users-stat-body">
            <span className="users-stat-label">Admins</span>
            <strong className="users-stat-value">{userStats.admins}</strong>
            <span className="users-stat-meta">Dashboard access</span>
          </div>
        </button>
        <button
          type="button"
          className={`users-stat-card staff ${userRoleFilter === 'staff' ? 'is-active' : ''}`}
          onClick={() => applyUserRoleFilter('staff')}
        >
          <div className="users-stat-icon" aria-hidden="true"><AdminNavIcon name="staffBuilding" /></div>
          <div className="users-stat-body">
            <span className="users-stat-label">Staff</span>
            <strong className="users-stat-value">{userStats.staff}</strong>
            <span className="users-stat-meta">Institution staff</span>
          </div>
        </button>
      </div>

      <div className="admin-controls users-controls">
        <div className="search-container users-search-container">
          <span className="search-icon" aria-hidden="true"><AdminNavIcon name="search" /></span>
          <input
            type="text"
            className="search-input"
            placeholder="Search name, email, or institution ID..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
        </div>
        <UsersRoleSelect value={userRoleFilter} onChange={applyUserRoleFilter} />
      </div>

      <div className="admin-grid single-column">
        <div className="content-section users-section">
          <h3 className="section-title">Registered Users</h3>
          <div className="table-container users-table-container admin-table-scroll">
            <table className="activity-table users-table">
              <colgroup>
                <col className="col-name" />
                <col className="col-email" />
                <col className="col-role" />
                <col className="col-affiliation" />
                <col className="col-institution" />
                <col className="col-joined" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-name">
                    <SortableHeader
                      label="Name"
                      field="name"
                      activeField={userSortField}
                      direction={userSortDir}
                      onSort={toggleUserSort}
                    />
                  </th>
                  <th className="col-email">Email</th>
                  <th className="col-role">
                    <SortableHeader
                      label="Role"
                      field="role"
                      activeField={userSortField}
                      direction={userSortDir}
                      onSort={toggleUserSort}
                    />
                  </th>
                  <th className="col-affiliation">
                    <SortableHeader
                      label="Affiliation"
                      field="affiliation"
                      activeField={userSortField}
                      direction={userSortDir}
                      onSort={toggleUserSort}
                    />
                  </th>
                  <th className="col-institution">Institution ID</th>
                  <th className="col-joined">
                    <SortableHeader
                      label="Joined"
                      field="joined"
                      activeField={userSortField}
                      direction={userSortDir}
                      onSort={toggleUserSort}
                    />
                  </th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoadError && !usersLoading ? (
                  <tr>
                    <td colSpan="7">
                      <div className="users-empty-state">
                        <div className="users-empty-icon" aria-hidden="true"><AdminNavIcon name="warning" /></div>
                        <h4>Could not load users</h4>
                        <p>{usersLoadError}</p>
                        <button type="button" className="action-btn users-refresh-btn" onClick={loadUsers}>
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : usersLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`user-skeleton-${index}`} className="skeleton-row">
                      <td><span className="skeleton-block wide" /></td>
                      <td><span className="skeleton-block" /></td>
                      <td><span className="skeleton-block short" /></td>
                      <td><span className="skeleton-block short" /></td>
                      <td><span className="skeleton-block short" /></td>
                      <td><span className="skeleton-block short" /></td>
                      <td><span className="skeleton-block short" /></td>
                    </tr>
                  ))
                ) : sortedUsers.length > 0 ? (
                  paginatedUsers.map((entry) => {
                    const fullName = formatDisplayName(entry);
                    const isSelf = Number(entry.id) === Number(user.id || 0);
                    const roleBadgeClass = getRoleBadgeClass(entry);
                    const isSaving = userRoleSavingId === entry.id;
                    const affiliationLabel = entry.affiliation
                      ? String(entry.affiliation).charAt(0).toUpperCase() + String(entry.affiliation).slice(1).toLowerCase()
                      : '-';

                    return (
                      <tr
                        key={entry.id}
                        className="users-table-row"
                        onClick={() => openUserProfile(entry)}
                      >
                        <td className="col-name">
                          <div className="user-name-cell">
                            <span className={`user-avatar ${roleBadgeClass}`} aria-hidden="true">{getUserInitials(entry)}</span>
                            <span className="user-name-text">{fullName}</span>
                          </div>
                        </td>
                        <td className="col-email email-cell" data-tooltip={entry.email}>{entry.email}</td>
                        <td className="col-role">
                          <span className={`role-pill ${roleBadgeClass}`}>
                            <UserRoleIcon role={entry.role} affiliation={entry.affiliation} />
                            {getRoleLabel(entry)}
                          </span>
                        </td>
                        <td className="col-affiliation">{affiliationLabel}</td>
                        <td className="col-institution">{entry.institution_id || '-'}</td>
                        <td className="col-joined">{formatUserDate(entry.created_at)}</td>
                        <td className="user-action-cell col-actions" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className={`kebab-trigger ${userActionMenu?.entry?.id === entry.id ? 'is-open' : ''}`}
                            aria-label={`Actions for ${fullName}`}
                            aria-expanded={userActionMenu?.entry?.id === entry.id}
                            onClick={(event) => openUserActionMenu(event, entry)}
                          >
                            <span className="kebab-dots" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7">
                      <div className="users-empty-state">
                        <div className="users-empty-icon" aria-hidden="true"><AdminNavIcon name="users" /></div>
                        <h4>No users found</h4>
                        <p>Try adjusting your search or role filter.</p>
                        <button
                          type="button"
                          className="action-btn users-refresh-btn"
                          onClick={() => {
                            setUserSearch('');
                            applyUserRoleFilter('all');
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sortedUsers.length > 0 && !usersLoading && (
            <div className="table-footer users-pagination">
              <span className="users-pagination-summary">
                Showing {userPageStart}–{userPageEnd} of {sortedUsers.length} users
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                  disabled={currentUserPage === 1}
                >
                  Previous
                </button>
                <span className="pagination-status">Page {currentUserPage} of {userPageCount}</span>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={() => setUserPage((page) => Math.min(userPageCount, page + 1))}
                  disabled={currentUserPage === userPageCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>

  );
};

export default AdminUsersSection;
