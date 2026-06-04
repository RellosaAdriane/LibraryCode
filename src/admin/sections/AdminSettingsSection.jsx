import React from 'react';
import AdminNavIcon from '../components/AdminNavIcon';
import SettingsSectionCard from '../components/SettingsSectionCard';
import UsersRoleSelect from '../components/UsersRoleSelect';
import { SESSION_STATUS_FILTER_OPTIONS } from '../constants';
import { parseSessionAgent } from '../utils/sessionUtils';

const AdminSettingsSection = ({ admin }) => {
  const {
    settingsTab, setSettingsTab, SETTINGS_TABS, settingsSummary,
    activityLog, handleClearActivityLog, loadBooks, loadSecurityLogs,
    securityLogs, securityLogsLoading,
    announcementSettings, setAnnouncementSettings, announcementSettingsLoading,
    announcementSettingsSaving, handleAnnouncementToggle, handleAnnouncementSettingsSave,
    penaltySettings, setPenaltySettings, penaltySettingsLoading, penaltySettingsSaving,
    handlePenaltySettingsSave,
    ssoSettings, ssoSettingsForm, setSsoSettingsForm, ssoSettingsLoading, ssoSettingsSaving,
    handleSsoToggle, handleSsoSave,
    admin2faSettings, admin2faLoading, admin2faSaving, handleAdmin2faToggle,
    signupSettings, signupSettingsLoading, signupSettingsSaving, handleSignupVerificationToggle,
    loadSessions, sessionsRefreshing, sessionSearch, setSessionSearch,
    sessionStatusFilter, setSessionStatusFilter, sessionsLoading, filteredSessions,
    user, handleRevokeSession, formatSessionTime
  } = admin;

  const activeTab = SETTINGS_TABS.find((tab) => tab.id === settingsTab) || SETTINGS_TABS[0];

  return (

    <div className="settings-page">
      <div className="settings-sticky-bar">
        <div className="settings-breadcrumb">
          <span>Settings</span>
          <span className="settings-breadcrumb-sep">/</span>
          <strong>{activeTab.label}</strong>
        </div>
      </div>

      <div className="settings-summary-grid">
        <div className="settings-summary-card">
          <span className="settings-summary-label">Active Sessions</span>
          <strong>{settingsSummary.activeSessions}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Students Online</span>
          <strong>{settingsSummary.studentsOnline}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Low Stock Titles</span>
          <strong>{settingsSummary.overdueBooks}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-label">Failed Login Events</span>
          <strong>{settingsSummary.failedLogins}</strong>
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings categories">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={settingsTab === tab.id}
            className={`settings-tab ${settingsTab === tab.id ? 'active' : ''}`}
            onClick={() => setSettingsTab(tab.id)}
          >
            <span className="settings-tab-icon" aria-hidden="true"><AdminNavIcon name={tab.icon} /></span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-tab-panel" role="tabpanel">
        {settingsTab === 'general' && (
          <>
            <SettingsSectionCard
              icon={<AdminNavIcon name="activity" />}
              title="Activity Logs"
              description="Manage local admin activity records shown on this dashboard."
              actions={(
                <button type="button" className="btn-danger" onClick={handleClearActivityLog}>Clear Logs</button>
              )}
            >
              <p className="settings-helper-text">
                {activityLog.length > 0
                  ? `${activityLog.length} local entries recorded in this browser session.`
                  : 'No local activity entries yet.'}
              </p>
            </SettingsSectionCard>

            <SettingsSectionCard
              icon={<AdminNavIcon name="books" />}
              title="Library Data"
              description="Reload books and inventory from the server."
              actions={(
                <button type="button" className="btn-secondary" onClick={loadBooks}>
                  <span className="btn-icon" aria-hidden="true"><AdminNavIcon name="refresh" /></span>
                  Refresh
                </button>
              )}
            >
              <p className="settings-helper-text">Use this after bulk updates or when inventory looks stale.</p>
            </SettingsSectionCard>

            <SettingsSectionCard
              icon={<AdminNavIcon name="logs" />}
              title="Security Logs"
              description="Reload authentication and security audit events."
              actions={(
                <button type="button" className="btn-secondary" onClick={loadSecurityLogs}>Refresh Logs</button>
              )}
            >
              <p className="settings-helper-text">
                {securityLogsLoading
                  ? 'Loading security events...'
                  : `${securityLogs.length} recent security events loaded.`}
              </p>
            </SettingsSectionCard>
          </>
        )}

        {settingsTab === 'announcements' && (
          <SettingsSectionCard
            icon={<AdminNavIcon name="bell" />}
            title="Student Announcement"
            description={
              announcementSettingsLoading
                ? 'Loading announcement settings...'
                : announcementSettings.enabled
                  ? 'The announcement is visible on the student dashboard.'
                  : 'No announcement is currently displayed to students.'
            }
            actions={(
              <button
                type="button"
                className={announcementSettings.enabled ? 'btn-danger' : 'btn-secondary'}
                onClick={handleAnnouncementToggle}
                disabled={announcementSettingsLoading || announcementSettingsSaving}
              >
                {announcementSettingsSaving ? 'Saving...' : announcementSettings.enabled ? 'Hide' : 'Show'}
              </button>
            )}
          >
            <div className="setting-form-row">
              <label className="setting-field-label" htmlFor="announcement-title">Announcement title</label>
              <input
                id="announcement-title"
                className="setting-input"
                type="text"
                placeholder="Library Notice"
                value={announcementSettings.title}
                onChange={(event) => setAnnouncementSettings((prev) => ({ ...prev, title: event.target.value }))}
                disabled={announcementSettingsLoading}
              />
            </div>
            <div className="setting-form-row">
              <label className="setting-field-label" htmlFor="announcement-message">Announcement message</label>
              <textarea
                id="announcement-message"
                className="setting-input setting-textarea"
                placeholder="Type the announcement shown to students..."
                rows={5}
                value={announcementSettings.message}
                onChange={(event) => setAnnouncementSettings((prev) => ({ ...prev, message: event.target.value }))}
                disabled={announcementSettingsLoading}
              />
              <small className="setting-hint">This message appears on the student dashboard when enabled.</small>
            </div>
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={announcementSettings.enabled}
                onChange={(event) => setAnnouncementSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
                disabled={announcementSettingsLoading}
              />
              <span>Show announcement on student dashboard</span>
            </label>
            <div className="setting-form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleAnnouncementSettingsSave}
                disabled={announcementSettingsLoading || announcementSettingsSaving}
              >
                {announcementSettingsSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </SettingsSectionCard>
        )}

        {settingsTab === 'borrowing' && (
          <SettingsSectionCard
            icon={<AdminNavIcon name="books" />}
            title="Borrowing Rules"
            description={
              penaltySettingsLoading
                ? 'Loading penalty policy...'
                : `Grace: ${penaltySettings.grace_days} days · Fee: PHP ${penaltySettings.daily_fee}/day · Block after ${penaltySettings.block_overdue_days} days overdue`
            }
            actions={(
              <button
                type="button"
                className="btn-primary"
                onClick={handlePenaltySettingsSave}
                disabled={penaltySettingsLoading || penaltySettingsSaving}
              >
                {penaltySettingsSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          >
            <div className="settings-form-grid">
              <div className="setting-form-row">
                <label className="setting-field-label" htmlFor="penalty-grace">Grace period (days)</label>
                <input
                  id="penalty-grace"
                  className="setting-input"
                  type="number"
                  min="0"
                  value={penaltySettings.grace_days}
                  onChange={(event) => setPenaltySettings((prev) => ({ ...prev, grace_days: event.target.value }))}
                  disabled={penaltySettingsLoading}
                />
              </div>
              <div className="setting-form-row">
                <label className="setting-field-label" htmlFor="penalty-fee">Daily fee (PHP)</label>
                <input
                  id="penalty-fee"
                  className="setting-input"
                  type="number"
                  min="0"
                  step="1"
                  value={penaltySettings.daily_fee}
                  onChange={(event) => setPenaltySettings((prev) => ({ ...prev, daily_fee: event.target.value }))}
                  disabled={penaltySettingsLoading}
                />
              </div>
              <div className="setting-form-row">
                <label className="setting-field-label" htmlFor="penalty-block">Borrowing block after (days overdue)</label>
                <input
                  id="penalty-block"
                  className="setting-input"
                  type="number"
                  min="0"
                  value={penaltySettings.block_overdue_days}
                  onChange={(event) => setPenaltySettings((prev) => ({ ...prev, block_overdue_days: event.target.value }))}
                  disabled={penaltySettingsLoading}
                />
              </div>
            </div>
          </SettingsSectionCard>
        )}

        {settingsTab === 'authentication' && (
          <>
            <SettingsSectionCard
              icon={<AdminNavIcon name="adminShield" />}
              title="SSO / LDAP"
              description={
                ssoSettingsLoading
                  ? 'Loading SSO configuration...'
                  : ssoSettings.enabled
                    ? 'SSO login is enabled for allowed domains.'
                    : 'SSO login is currently disabled.'
              }
              actions={(
                <button
                  type="button"
                  className={ssoSettingsForm.enabled ? 'btn-danger' : 'btn-primary'}
                  onClick={handleSsoToggle}
                  disabled={ssoSettingsLoading || ssoSettingsSaving}
                >
                  {ssoSettingsSaving ? 'Saving...' : ssoSettingsForm.enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            >
              <div className="setting-form-row">
                <label className="setting-field-label" htmlFor="sso-provider">Provider label</label>
                <input
                  id="sso-provider"
                  className="setting-input"
                  type="text"
                  value={ssoSettingsForm.provider_name}
                  onChange={(event) => setSsoSettingsForm((prev) => ({ ...prev, provider_name: event.target.value }))}
                  disabled={ssoSettingsLoading}
                />
              </div>
              <div className="setting-form-row">
                <label className="setting-field-label" htmlFor="sso-domains">Allowed domains</label>
                <input
                  id="sso-domains"
                  className="setting-input"
                  type="text"
                  placeholder="cvsu.edu.ph, gmail.com"
                  value={ssoSettingsForm.allowed_domains}
                  onChange={(event) => setSsoSettingsForm((prev) => ({ ...prev, allowed_domains: event.target.value }))}
                  disabled={ssoSettingsLoading}
                />
                <small className="setting-hint">Comma-separated list of email domains.</small>
              </div>
              <label className="setting-checkbox">
                <input
                  type="checkbox"
                  checked={ssoSettingsForm.admin_only}
                  onChange={(event) => setSsoSettingsForm((prev) => ({ ...prev, admin_only: event.target.checked }))}
                  disabled={ssoSettingsLoading}
                />
                <span>Restrict SSO to admin accounts only</span>
              </label>
              <div className="setting-form-actions">
                <button type="button" className="btn-primary" onClick={handleSsoSave} disabled={ssoSettingsLoading || ssoSettingsSaving}>
                  {ssoSettingsSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </SettingsSectionCard>

            <SettingsSectionCard
              icon={<AdminNavIcon name="adminShield" />}
              title="Admin 2FA"
              description={
                admin2faLoading
                  ? 'Loading admin 2FA status...'
                  : admin2faSettings.enabled
                    ? 'Admins must verify a 6-digit email code on login.'
                    : 'Admin 2FA is currently disabled.'
              }
              actions={(
                <button
                  type="button"
                  className={admin2faSettings.enabled ? 'btn-danger' : 'btn-primary'}
                  onClick={handleAdmin2faToggle}
                  disabled={admin2faLoading || admin2faSaving}
                >
                  {admin2faSaving ? 'Saving...' : admin2faSettings.enabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              )}
            >
              <p className="settings-helper-text">Recommended for production admin accounts.</p>
            </SettingsSectionCard>

            <SettingsSectionCard
              icon={<AdminNavIcon name="studentCap" />}
              title="Email Verification on Signup"
              description={
                signupSettingsLoading
                  ? 'Loading signup verification setting...'
                  : signupSettings.email_verification_enabled
                    ? 'Students must verify email with OTP before signup completes.'
                    : 'Students can sign up without email verification.'
              }
              actions={(
                <button
                  type="button"
                  className={signupSettings.email_verification_enabled ? 'btn-danger' : 'btn-primary'}
                  onClick={handleSignupVerificationToggle}
                  disabled={signupSettingsLoading || signupSettingsSaving}
                >
                  {signupSettingsSaving ? 'Saving...' : signupSettings.email_verification_enabled ? 'Disable' : 'Enable'}
                </button>
              )}
            />
          </>
        )}

        {settingsTab === 'sessions' && (
          <SettingsSectionCard
            icon={<AdminNavIcon name="activity" />}
            title="Active Sessions"
            description="Review devices, revoke access, and monitor sign-ins."
            actions={(
              <button type="button" className="btn-secondary" onClick={loadSessions} disabled={sessionsRefreshing}>
                <span className={`btn-icon ${sessionsRefreshing ? 'is-spinning' : ''}`} aria-hidden="true"><AdminNavIcon name="refresh" /></span>
                {sessionsRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            )}
          >
            <div className="settings-session-controls">
              <div className="search-container settings-search-container">
                <span className="search-icon" aria-hidden="true"><AdminNavIcon name="search" /></span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search email, IP, browser, or OS..."
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                />
              </div>
              <UsersRoleSelect
                value={sessionStatusFilter}
                onChange={setSessionStatusFilter}
                options={SESSION_STATUS_FILTER_OPTIONS}
              />
            </div>

            <div className="table-container settings-sessions-table">
              <table className="activity-table sessions-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Device</th>
                    <th>Location</th>
                    <th>Last Seen</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionsLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <tr key={`session-skeleton-${index}`} className="skeleton-row">
                        <td colSpan="6"><span className="skeleton-block wide" /></td>
                      </tr>
                    ))
                  ) : filteredSessions.length > 0 ? (
                    filteredSessions.map((session) => {
                      const isRevoked = Boolean(session.revoked_at);
                      const isCurrent = session.id === user?.session_id;
                      const device = parseSessionAgent(session.user_agent);
                      const lastSeen = Date.parse(session.last_seen_at || '');
                      const isStale = !Number.isNaN(lastSeen) && (Date.now() - lastSeen) > (7 * 24 * 60 * 60 * 1000);

                      return (
                        <tr key={session.id} className={isCurrent ? 'session-row-current' : ''}>
                          <td>
                            <div className="session-user-cell">
                              <strong>{session.email || '-'}</strong>
                              <span className={`role-pill ${session.role === 'admin' ? 'admin' : 'student'}`}>
                                {session.role || 'student'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="session-device-cell" title={session.user_agent || ''}>
                              <span className="session-device-icon" aria-hidden="true">
                                <AdminNavIcon name={device.deviceIcon} />
                              </span>
                              <div>
                                <strong>{device.browser}</strong>
                                <small>{device.os} · {device.deviceType}</small>
                              </div>
                            </div>
                          </td>
                          <td>{session.ip || '-'}</td>
                          <td>{formatSessionTime(session.last_seen_at)}</td>
                          <td>
                            {isCurrent && !isRevoked ? (
                              <span className="session-pill current">Current Device</span>
                            ) : isRevoked ? (
                              <span className="session-pill revoked">Revoked</span>
                            ) : isStale ? (
                              <span className="session-pill stale">Inactive</span>
                            ) : (
                              <span className="session-pill active">Active</span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => handleRevokeSession(session.id, session.email)}
                              disabled={isRevoked}
                            >
                              {isRevoked ? 'Revoked' : 'Revoke'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6">
                        <div className="users-empty-state compact">
                          <p>No sessions match your filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SettingsSectionCard>
        )}
      </div>
    </div>
  );
};

export default AdminSettingsSection;
