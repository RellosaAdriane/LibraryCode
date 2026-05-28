import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { clearAuth, getStoredUser, updateStoredUser } from './auth';
import './Dashboard.css';

const emptyForm = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  intro: '',
  quantity: 1
};

const LOW_STOCK_THRESHOLD = 2;
const BOOKS_PAGE_SIZE = 10;
const USERS_PAGE_SIZE = 10;

const USER_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Roles' },
  { value: 'admin', label: 'Admins' },
  { value: 'student', label: 'Students' },
  { value: 'staff', label: 'Staff' }
];

const SESSION_STATUS_FILTER_OPTIONS = [
  { value: 'active', label: 'Active Sessions' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'all', label: 'All Sessions' }
];

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: 'dashboard' },
  { id: 'announcements', label: 'Announcements', icon: 'bell' },
  { id: 'borrowing', label: 'Borrowing Rules', icon: 'books' },
  { id: 'authentication', label: 'Authentication', icon: 'adminShield' },
  { id: 'sessions', label: 'Sessions & Security', icon: 'activity' }
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getBookQuantity = (book = {}) => {
  const quantity = toNumber(book.quantity);
  if (quantity !== null) return Math.max(0, quantity);

  const legacyQuantity = toNumber(book.copies_total);
  if (legacyQuantity !== null) return Math.max(0, legacyQuantity);

  return 0;
};

const getBookAvailable = (book = {}) => {
  const quantity = getBookQuantity(book);
  const available = toNumber(book.available);
  const legacyAvailable = toNumber(book.copies_available);
  const rawAvailable = available ?? legacyAvailable ?? quantity;
  return Math.min(Math.max(0, rawAvailable), quantity);
};

const isLowStockBook = (book = {}) => {
  const available = getBookAvailable(book);
  return available > 0 && available <= LOW_STOCK_THRESHOLD;
};

const getStockBadgeClass = (book = {}) => {
  const available = getBookAvailable(book);
  if (available <= 0) return 'stock-badge danger';
  if (available <= 5) return 'stock-badge warning';
  return 'stock-badge normal';
};

const appendStatusMessage = (baseMessage, nextMessage) => {
  const base = String(baseMessage || '').trim().replace(/[.!?]+$/, '');
  const next = String(nextMessage || '').trim().replace(/[.!?]+$/, '');
  if (!base) return next ? `${next}.` : '';
  if (!next) return `${base}.`;
  return `${base}. ${next}.`;
};

const joinStatusParts = (parts) => {
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

const AdminNavIcon = ({ name }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };

  const icons = {
    dashboard: (
      <svg {...commonProps}>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="15" width="7" height="6" rx="1.5" />
      </svg>
    ),
    books: (
      <svg {...commonProps}>
        <path d="M5 4.5h9.5A3.5 3.5 0 0 1 18 8v12H8.5A3.5 3.5 0 0 1 5 16.5z" />
        <path d="M8 4.5v12A3.5 3.5 0 0 0 11.5 20" />
        <path d="M8 8h7" />
        <path d="M8 11h6" />
      </svg>
    ),
    analytics: (
      <svg {...commonProps}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 16l3.5-4 3 2.5L19 8" />
        <path d="M17 8h2v2" />
      </svg>
    ),
    activity: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
    logs: (
      <svg {...commonProps}>
        <path d="M7 3.5h7l3 3V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
        <path d="M14 3.5V7h3" />
        <path d="M9 11h6" />
        <path d="M9 15h6" />
      </svg>
    ),
    users: (
      <svg {...commonProps}>
        <path d="M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19" />
        <circle cx="10" cy="8" r="3" />
        <path d="M20 19v-1.2a3 3 0 0 0-2.4-2.9" />
        <path d="M16.5 5.3a3 3 0 0 1 0 5.4" />
      </svg>
    ),
    settings: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05-2.1 2.1-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.66V20.5h-3v-.12A1.8 1.8 0 0 0 10.5 18.7a1.8 1.8 0 0 0-1.98.36l-.05.05-2.1-2.1.05-.05A1.8 1.8 0 0 0 6.8 15a1.8 1.8 0 0 0-1.66-1.1H5v-3h.14A1.8 1.8 0 0 0 6.8 9.8a1.8 1.8 0 0 0-.36-1.98l-.05-.05 2.1-2.1.05.05A1.8 1.8 0 0 0 10.5 6.1a1.8 1.8 0 0 0 1.1-1.66V4.3h3v.14a1.8 1.8 0 0 0 1.1 1.66 1.8 1.8 0 0 0 1.98-.36l.05-.05 2.1 2.1-.05.05a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.66 1.1h.12v3h-.12A1.8 1.8 0 0 0 19.4 15z" />
      </svg>
    ),
    copies: (
      <svg {...commonProps}>
        <path d="M7 7.5 12 5l5 2.5-5 2.5z" />
        <path d="M7 7.5v6L12 16l5-2.5v-6" />
        <path d="M12 10v6" />
        <path d="M5 11 3.5 12 12 16.5 20.5 12 19 11" />
      </svg>
    ),
    available: (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="m8.5 12.5 2.4 2.4 4.9-5.3" />
      </svg>
    ),
    warning: (
      <svg {...commonProps}>
        <path d="M12 4 21 20H3z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    ),
    studentCap: (
      <svg {...commonProps}>
        <path d="M22 10 12 3 2 10l10 6 10-6z" />
        <path d="M6 12v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" />
      </svg>
    ),
    adminShield: (
      <svg {...commonProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    staffBuilding: (
      <svg {...commonProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5h8v2" />
        <path d="M9 12h2" />
        <path d="M13 12h2" />
        <path d="M9 16h2" />
        <path d="M13 16h2" />
      </svg>
    ),
    search: (
      <svg {...commonProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
    refresh: (
      <svg {...commonProps}>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    ),
    plus: (
      <svg {...commonProps}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    ),
    returnBook: (
      <svg {...commonProps}>
        <path d="M4 12h11" />
        <path d="M11 5l7 7-7 7" />
      </svg>
    ),
    loan: (
      <svg {...commonProps}>
        <path d="M5 4.5h10A2.5 2.5 0 0 1 17.5 7v11H7.5A2.5 2.5 0 0 1 5 15.5z" />
        <path d="M8 4.5v11A2.5 2.5 0 0 0 10.5 18" />
        <path d="M14 9h3" />
      </svg>
    ),
    bell: (
      <svg {...commonProps}>
        <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    ),
    laptop: (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M2 19h20" />
      </svg>
    ),
    mobile: (
      <svg {...commonProps}>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </svg>
    )
  };

  return icons[name] || null;
};

const parseSessionAgent = (userAgent) => {
  const agent = String(userAgent || '');
  let browser = 'Browser';
  let os = 'Unknown OS';
  let deviceType = 'Desktop';
  let deviceIcon = 'laptop';

  if (/Edg\//i.test(agent)) browser = 'Edge';
  else if (/Chrome\//i.test(agent)) browser = 'Chrome';
  else if (/Firefox\//i.test(agent)) browser = 'Firefox';
  else if (/Safari\//i.test(agent) && !/Chrome/i.test(agent)) browser = 'Safari';

  if (/Windows/i.test(agent)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(agent)) os = 'macOS';
  else if (/Android/i.test(agent)) os = 'Android';
  else if (/iPhone|iPad/i.test(agent)) os = /iPad/i.test(agent) ? 'iPadOS' : 'iOS';
  else if (/Linux/i.test(agent)) os = 'Linux';

  if (/Mobile|Android|iPhone/i.test(agent)) {
    deviceType = 'Mobile';
    deviceIcon = 'mobile';
  } else if (/iPad|Tablet/i.test(agent)) {
    deviceType = 'Tablet';
    deviceIcon = 'mobile';
  }

  return { browser, os, deviceType, deviceIcon };
};

const SettingsSectionCard = ({ icon, title, description, actions, children }) => (
  <section className="settings-section-card">
    <header className="settings-section-header">
      <div className="settings-section-title-wrap">
        <span className="settings-section-icon" aria-hidden="true">{icon}</span>
        <div>
          <h4>{title}</h4>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="settings-section-actions">{actions}</div> : null}
    </header>
    <div className="settings-section-body">{children}</div>
  </section>
);

const filterBorrowRecords = (records, query) => {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return records;
  return records.filter((record) => (
    String(record.studentName || '').toLowerCase().includes(normalized)
    || String(record.email || '').toLowerCase().includes(normalized)
    || String(record.title || '').toLowerCase().includes(normalized)
  ));
};

const getBorrowTableContainerClass = (rowCount, loading) => {
  if (loading || rowCount > 4) return 'table-container';
  return 'table-container table-container-compact';
};

const getManilaDateKey = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const isRecordDateToday = (dateValue) => {
  if (!dateValue) return false;
  return String(dateValue).slice(0, 10) === getManilaDateKey();
};

const getTimeGreeting = () => {
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

const parseLibraryTimestamp = (dateValue) => {
  if (!dateValue) return NaN;
  const raw = String(dateValue).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return Date.parse(`${raw}T12:00:00+08:00`);
  }
  return Date.parse(raw);
};

const formatRelativeTime = (dateValue) => {
  if (!dateValue) return 'Recently';
  const parsed = parseLibraryTimestamp(dateValue);
  if (Number.isNaN(parsed)) return String(dateValue).slice(0, 10);
  const diffMs = Date.now() - parsed;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(parsed).toLocaleDateString();
};

const SectionTitle = ({ icon, children }) => (
  <h3 className="section-title section-title-with-icon">
    {icon ? (
      <span className="section-title-icon" aria-hidden="true">
        <AdminNavIcon name={icon} />
      </span>
    ) : null}
    <span>{children}</span>
  </h3>
);

const renderPenaltyCell = (record) => {
  if (Number(record.penaltyAmount) > 0) {
    return (
      <span className="penalty-pill fee" title="Penalty charged">
        PHP {Number(record.penaltyAmount).toFixed(2)}
      </span>
    );
  }
  if (Number(record.overdueDays) > 0) {
    return (
      <span className="penalty-pill late" title="Returned after due date">
        {record.overdueDays} day(s) late
      </span>
    );
  }
  return <span className="penalty-pill clear">On time</span>;
};

const AdminTableEmpty = ({ colSpan = 6, icon = '📚', title, message }) => (
  <tr>
    <td colSpan={colSpan} className="admin-table-empty">
      <div className="admin-table-empty-inner">
        <span className="admin-table-empty-icon" aria-hidden="true">{icon}</span>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </td>
  </tr>
);

const formatDisplayName = (entry) => {
  const formatPart = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const fullName = `${formatPart(entry?.first_name)} ${formatPart(entry?.last_name)}`.trim();
  return fullName || 'Unknown User';
};

const UsersRoleSelect = ({ value, onChange, options = USER_ROLE_FILTER_OPTIONS }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="custom-select users-role-select" ref={rootRef}>
      <button
        type="button"
        className="custom-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{selected.label}</span>
        <span className={`custom-select-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">▼</span>
      </button>
      {open && (
        <ul className="custom-select-menu" role="listbox">
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === option.value}
                className={`custom-select-option ${value === option.value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SortableHeader = ({ label, field, activeField, direction, onSort }) => {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      className={`sortable-th ${isActive ? 'is-active' : ''}`}
      onClick={() => onSort(field)}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <span className={`sort-indicator ${isActive ? 'is-visible' : ''}`} aria-hidden="true">
        {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
};

const UserRoleIcon = ({ role, affiliation }) => {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.9',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true'
  };
  const normalizedRole = String(role || '').toLowerCase();
  const normalizedAffiliation = String(affiliation || '').toLowerCase();

  if (normalizedRole === 'admin') {
    return (
      <svg {...commonProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }

  if (normalizedAffiliation === 'staff' || normalizedRole === 'staff') {
    return (
      <svg {...commonProps}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5h8v2" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M22 10 12 3 2 10l10 6 10-6z" />
      <path d="M6 12v5c0 2.2 2.7 4 6 4s6-1.8 6-4v-5" />
    </svg>
  );
};

const getUserInitials = (entry) => {
  const first = String(entry?.first_name || '').trim();
  const last = String(entry?.last_name || '').trim();
  const initials = `${first.charAt(0) || ''}${last.charAt(0) || ''}`.toUpperCase();
  return initials || '?';
};

const getRoleBadgeClass = (entry) => {
  const role = String(entry?.role || '').toLowerCase();
  const affiliation = String(entry?.affiliation || '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (affiliation === 'staff' || role === 'staff') return 'staff';
  return 'student';
};

const getRoleLabel = (entry) => {
  const role = String(entry?.role || '').toLowerCase();
  const affiliation = String(entry?.affiliation || '').toLowerCase();
  if (role === 'admin') return 'Admin';
  if (affiliation === 'staff' || role === 'staff') return 'Staff';
  return 'Student';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser() || {};

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [bookPage, setBookPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [bookFormStatus, setBookFormStatus] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [qrGeneratingId, setQrGeneratingId] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activityLog, setActivityLog] = useState([]);
  const [studentActivityLog, setStudentActivityLog] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [securityLogsLoading, setSecurityLogsLoading] = useState(true);
  const [signupSettings, setSignupSettings] = useState({
    email_verification_enabled: true
  });
  const [signupSettingsLoading, setSignupSettingsLoading] = useState(true);
  const [signupSettingsSaving, setSignupSettingsSaving] = useState(false);
  const [penaltySettings, setPenaltySettings] = useState({
    grace_days: 7,
    daily_fee: 150,
    block_overdue_days: 14
  });
  const [penaltySettingsLoading, setPenaltySettingsLoading] = useState(true);
  const [penaltySettingsSaving, setPenaltySettingsSaving] = useState(false);
  const [announcementSettings, setAnnouncementSettings] = useState({
    enabled: false,
    title: 'Library Notice',
    message: ''
  });
  const [announcementSettingsLoading, setAnnouncementSettingsLoading] = useState(true);
  const [announcementSettingsSaving, setAnnouncementSettingsSaving] = useState(false);
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
  const [userToast, setUserToast] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [userActionMenu, setUserActionMenu] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [profileSessions, setProfileSessions] = useState([]);
  const [profileSessionsLoading, setProfileSessionsLoading] = useState(false);
  const [profileBorrows, setProfileBorrows] = useState([]);
  const [profileBorrowsLoading, setProfileBorrowsLoading] = useState(false);
  const [borrowRecords, setBorrowRecords] = useState({ active: [], returned: [] });
  const [borrowRecordCounts, setBorrowRecordCounts] = useState({ active: 0, returned: 0 });
  const [borrowRecordsLoading, setBorrowRecordsLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentActivityLoading, setRecentActivityLoading] = useState(true);
  const [recentActivityError, setRecentActivityError] = useState('');
  const [activeBorrowSearch, setActiveBorrowSearch] = useState('');
  const [returnedBookSearch, setReturnedBookSearch] = useState('');
  const [profileAdminNotes, setProfileAdminNotes] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('admin_user_notes') || '{}');
    } catch {
      return {};
    }
  });
  const [ssoSettings, setSsoSettings] = useState({
    enabled: false,
    provider_name: 'SSO / LDAP',
    allowed_domains: [],
    admin_only: false
  });
  const [ssoSettingsForm, setSsoSettingsForm] = useState({
    provider_name: 'SSO / LDAP',
    allowed_domains: '',
    enabled: false,
    admin_only: false
  });
  const [ssoSettingsLoading, setSsoSettingsLoading] = useState(true);
  const [ssoSettingsSaving, setSsoSettingsSaving] = useState(false);
  const [admin2faSettings, setAdmin2faSettings] = useState({ enabled: false });
  const [admin2faLoading, setAdmin2faLoading] = useState(true);
  const [admin2faSaving, setAdmin2faSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('active');
  const [philTime, setPhilTime] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(new Date());
    } catch (error) {
      return new Date().toLocaleTimeString();
    }
  });

  const getAdminDisplayName = useCallback(() => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.email || 'Admin';
  }, [user.email, user.first_name, user.last_name]);

  const logAction = (action, details) => {
    const now = Date.now();
    setActivityLog((prev) => [
      {
        id: now,
        adminName: getAdminDisplayName(),
        action,
        details,
        time: new Date().toLocaleString(),
        timestamp: now
      },
      ...prev
    ]);
  };

  const loadStudentActivity = useCallback(() => {
    const prefix = 'library.student.';
    const suffix = '.activity';
    const collected = [];

    // Load server-side persisted activities first (so admin sees all students)
    (async () => {
      try {
        const result = await api.getStudentActivities();
        if (result.success && Array.isArray(result.activities)) {
          result.activities.forEach((entry, idx) => {
            const ts = Number(entry.timestamp) || Date.parse(entry.time || '') || 0;
            collected.push({
              id: `student-server-${idx}-${ts}`,
              source: 'Student',
              user: entry.email || 'student',
              action: entry.action || 'Activity',
              details: entry.details || '-',
              time: entry.time || '-',
              timestamp: ts
            });
          });
        }
      } catch (err) {
        // ignore server activity errors and fall back to localStorage
      }

      // Also merge localStorage entries for compatibility
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(prefix) || !key.endsWith(suffix)) continue;

        const studentEmail = key.slice(prefix.length, -suffix.length) || 'student';

        try {
          const raw = localStorage.getItem(key);
          const entries = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(entries)) continue;

          entries.forEach((entry, entryIndex) => {
            const timestamp = Number(entry?.timestamp) || Date.parse(entry?.date || '') || 0;
            collected.push({
              id: `student-${studentEmail}-${entry?.id || timestamp || entryIndex}`,
              source: 'Student',
              user: studentEmail,
              action: entry?.action || 'Activity',
              details: entry?.book_title || entry?.details || '-',
              time: entry?.time || entry?.date || '-',
              timestamp
            });
          });
        } catch (error) {
          // Ignore malformed student activity payloads.
        }
      }

      collected.sort((a, b) => b.timestamp - a.timestamp);
      setStudentActivityLog(collected);
    })();
  }, []);

  const menuItems = [
    { id: 'home', icon: 'dashboard', label: 'Dashboard' },
    { id: 'books', icon: 'books', label: 'Manage Books' },
    { id: 'circulation', icon: 'loan', label: 'Borrow / Return', parentId: 'books' },
    { id: 'analytics', icon: 'analytics', label: 'Analytics' },
    { id: 'activity', icon: 'activity', label: 'Admin Activity' },
    { id: 'student-logs', icon: 'logs', label: 'Student Logs' },
    { id: 'users', icon: 'users', label: 'Manage Users' },
    { id: 'settings', icon: 'settings', label: 'Settings' }
  ];

  const getPageTitle = () => {
    if (activeSection === 'books') return 'Book Management';
    if (activeSection === 'circulation') return 'Borrow & Return';
    if (activeSection === 'analytics') return 'Library Analytics';
    if (activeSection === 'activity') return 'Admin Activity Log';
    if (activeSection === 'student-logs') return 'Student Activity Logs';
    if (activeSection === 'users') return 'User Management';
    if (activeSection === 'settings') return 'Admin Settings';
    return 'Admin Dashboard Home';
  };

  const loadBorrowRecords = useCallback(async () => {
    setBorrowRecordsLoading(true);
    const result = await api.getAdminBorrowRecords({
      requesterId: user.id,
      requesterEmail: user.email,
      limit: 50
    });
    setBorrowRecordsLoading(false);

    if (result.success) {
      setBorrowRecords({
        active: Array.isArray(result.active) ? result.active : [],
        returned: Array.isArray(result.returned) ? result.returned : []
      });
      setBorrowRecordCounts({
        active: Number(result.counts?.active) || 0,
        returned: Number(result.counts?.returned) || 0
      });
      return;
    }

    setBorrowRecords({ active: [], returned: [] });
    setBorrowRecordCounts({ active: 0, returned: 0 });
  }, [user.email, user.id]);

  const loadRecentActivity = useCallback(async () => {
    setRecentActivityLoading(true);
    setRecentActivityError('');
    const result = await api.getAdminRecentCirculation({
      requesterId: user.id,
      requesterEmail: user.email,
      limit: 10
    });
    setRecentActivityLoading(false);

    if (result.success) {
      const items = Array.isArray(result.activities) ? result.activities : [];
      setRecentActivity(items.map((item) => ({
        id: `activity-${item.id}-${item.type}`,
        studentName: item.studentName,
        title: item.title,
        action: item.action,
        type: item.type,
        timeAgo: formatRelativeTime(item.activityAt)
      })));
      return;
    }

    setRecentActivity([]);
    setRecentActivityError(result.message || 'Unable to load recent activity.');
  }, [user.email, user.id]);

  const loadBooks = async ({ preserveMessage = false } = {}) => {
    setLoading(true);
    const result = await api.getBooks();
    if (result.success) {
      setBooks(Array.isArray(result.books) ? result.books : []);
      if (!preserveMessage) setMessage('');
    } else {
      setMessage(result.message || 'Failed to load books.');
    }
    setLoading(false);
  };

  const loadSignupSettings = useCallback(async () => {
    setSignupSettingsLoading(true);
    const result = await api.getSignupSettings();
    if (result.success && result.settings) {
      setSignupSettings({
        email_verification_enabled: Boolean(result.settings.email_verification_enabled)
      });
    } else {
      setMessage(result.message || 'Failed to load signup settings.');
    }
    setSignupSettingsLoading(false);
  }, []);

  const loadPenaltySettings = useCallback(async () => {
    setPenaltySettingsLoading(true);
    const result = await api.getPenaltySettings();
    if (result.success && result.settings) {
      setPenaltySettings({
        grace_days: Number(result.settings.grace_days ?? 7),
        daily_fee: Number(result.settings.daily_fee ?? 150),
        block_overdue_days: Number(result.settings.block_overdue_days ?? 14)
      });
    } else {
      setMessage(result.message || 'Failed to load penalty settings.');
    }
    setPenaltySettingsLoading(false);
  }, []);

  const loadAnnouncementSettings = useCallback(async () => {
    setAnnouncementSettingsLoading(true);
    const result = await api.getAnnouncementSettings();
    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
    } else {
      setMessage(result.message || 'Failed to load announcement settings.');
    }
    setAnnouncementSettingsLoading(false);
  }, []);

  const loadSecurityLogs = useCallback(async () => {
    setSecurityLogsLoading(true);
    const result = await api.getSecurityLogs();
    if (result.success) {
      setSecurityLogs(Array.isArray(result.logs) ? result.logs : []);
    } else {
      setMessage(result.message || 'Failed to load security logs.');
    }
    setSecurityLogsLoading(false);
  }, []);

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
  }, [user.id, user.email]);

  const loadSsoSettings = useCallback(async () => {
    setSsoSettingsLoading(true);
    const result = await api.getSsoSettings();
    if (result.success && result.settings) {
      const nextSettings = {
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: Array.isArray(result.settings.allowed_domains) ? result.settings.allowed_domains : [],
        admin_only: Boolean(result.settings.admin_only)
      };
      setSsoSettings(nextSettings);
      setSsoSettingsForm({
        enabled: nextSettings.enabled,
        provider_name: nextSettings.provider_name,
        allowed_domains: nextSettings.allowed_domains.join(', '),
        admin_only: nextSettings.admin_only
      });
    } else {
      setMessage(result.message || 'Failed to load SSO settings.');
    }
    setSsoSettingsLoading(false);
  }, []);

  const loadAdmin2faSettings = useCallback(async () => {
    setAdmin2faLoading(true);
    const result = await api.getAdmin2faSettings();
    if (result.success && result.settings) {
      setAdmin2faSettings({
        enabled: Boolean(result.settings.enabled)
      });
    } else {
      setMessage(result.message || 'Failed to load admin 2FA settings.');
    }
    setAdmin2faLoading(false);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsRefreshing(true);
    const result = await api.getSessions({ requesterId: user.id, requesterEmail: user.email, includeRevoked: true });
    if (result.success) {
      setSessions(Array.isArray(result.sessions) ? result.sessions : []);
    } else {
      setMessage(result.message || 'Failed to load sessions.');
    }
    setSessionsRefreshing(false);
    setSessionsLoading(false);
  }, [user.id, user.email]);

  const handleSsoSave = async () => {
    setSsoSettingsSaving(true);
    const allowedDomains = ssoSettingsForm.allowed_domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);

    const result = await api.updateSsoSettings({
      enabled: ssoSettingsForm.enabled,
      provider_name: ssoSettingsForm.provider_name,
      allowed_domains: allowedDomains,
      admin_only: ssoSettingsForm.admin_only
    });
    setSsoSettingsSaving(false);

    if (result.success && result.settings) {
      setSsoSettings(result.settings);
      setSsoSettingsForm({
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: (result.settings.allowed_domains || []).join(', '),
        admin_only: Boolean(result.settings.admin_only)
      });
      setMessage(result.message || 'SSO settings updated.');
      logAction('SSO Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      setMessage(result.message || 'Failed to update SSO settings.');
    }
  };

  const handleSsoToggle = async () => {
    const nextEnabled = !ssoSettingsForm.enabled;
    setSsoSettingsForm((prev) => ({
      ...prev,
      enabled: nextEnabled
    }));
    setSsoSettingsSaving(true);

    const allowedDomains = ssoSettingsForm.allowed_domains
      .split(',')
      .map((domain) => domain.trim())
      .filter(Boolean);

    const result = await api.updateSsoSettings({
      enabled: nextEnabled,
      provider_name: ssoSettingsForm.provider_name,
      allowed_domains: allowedDomains,
      admin_only: ssoSettingsForm.admin_only
    });
    setSsoSettingsSaving(false);

    if (result.success && result.settings) {
      setSsoSettings(result.settings);
      setSsoSettingsForm({
        enabled: Boolean(result.settings.enabled),
        provider_name: result.settings.provider_name || 'SSO / LDAP',
        allowed_domains: (result.settings.allowed_domains || []).join(', '),
        admin_only: Boolean(result.settings.admin_only)
      });
      setMessage(result.message || 'SSO settings updated.');
      logAction('SSO Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      setMessage(result.message || 'Failed to update SSO settings.');
    }
  };

  const handleAdmin2faToggle = async () => {
    const nextEnabled = !admin2faSettings.enabled;

    const runToggle = async () => {
      setAdmin2faSaving(true);
      const result = await api.updateAdmin2faSettings({ enabled: nextEnabled });
      setAdmin2faSaving(false);

      if (result.success && result.settings) {
        setAdmin2faSettings({ enabled: Boolean(result.settings.enabled) });
        showUserToast(result.settings.enabled ? 'Admin 2FA enabled.' : 'Admin 2FA disabled.');
        logAction('Admin 2FA', result.settings.enabled ? 'Enabled' : 'Disabled');
      } else {
        showUserToast(result.message || 'Failed to update admin 2FA.', true);
      }
    };

    if (!nextEnabled) {
      setConfirmDialog({
        title: 'Disable admin 2FA?',
        message: 'Admins will no longer need an email verification code at login. This reduces account security.',
        confirmLabel: 'Disable 2FA',
        onConfirm: async () => {
          setConfirmDialog(null);
          await runToggle();
        }
      });
      return;
    }

    await runToggle();
  };

  const handlePenaltySettingsSave = async () => {
    setPenaltySettingsSaving(true);
    const payload = {
      grace_days: Math.max(0, Number(penaltySettings.grace_days) || 0),
      daily_fee: Math.max(0, Number(penaltySettings.daily_fee) || 0),
      block_overdue_days: Math.max(0, Number(penaltySettings.block_overdue_days) || 0)
    };
    const result = await api.updatePenaltySettings(payload);
    setPenaltySettingsSaving(false);

    if (result.success && result.settings) {
      setPenaltySettings({
        grace_days: Number(result.settings.grace_days ?? payload.grace_days),
        daily_fee: Number(result.settings.daily_fee ?? payload.daily_fee),
        block_overdue_days: Number(result.settings.block_overdue_days ?? payload.block_overdue_days)
      });
      showUserToast('Borrowing rules saved successfully.');
      logAction('Penalty Settings', 'Updated');
    } else {
      showUserToast(result.message || 'Failed to update penalty settings.', true);
    }
  };

  const handleAnnouncementSettingsSave = async () => {
    setAnnouncementSettingsSaving(true);
    const result = await api.updateAnnouncementSettings({
      enabled: announcementSettings.enabled,
      title: announcementSettings.title,
      message: announcementSettings.message
    });
    setAnnouncementSettingsSaving(false);

    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
      showUserToast('Announcement updated successfully.');
      logAction('Announcement Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      showUserToast(result.message || 'Failed to update announcement settings.', true);
    }
  };

  const handleAnnouncementToggle = async () => {
    const nextEnabled = !announcementSettings.enabled;
    setAnnouncementSettings((prev) => ({
      ...prev,
      enabled: nextEnabled
    }));
    setAnnouncementSettingsSaving(true);

    const result = await api.updateAnnouncementSettings({
      enabled: nextEnabled,
      title: announcementSettings.title,
      message: announcementSettings.message
    });

    setAnnouncementSettingsSaving(false);
    setMessage(result.message || (result.success ? 'Announcement visibility updated.' : 'Failed to update announcement visibility.'));

    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
      logAction('Announcement Visibility', result.settings.enabled ? 'Enabled' : 'Disabled');
    }
  };

  const handleRevokeSession = (sessionId, sessionEmail = '') => {
    if (!sessionId) return;

    setConfirmDialog({
      title: 'Revoke session?',
      message: `This will sign out ${sessionEmail || 'this user'} from that device immediately. This action cannot be undone.`,
      confirmLabel: 'Revoke session',
      onConfirm: async () => {
        setConfirmDialog(null);
        const result = await api.revokeSession({
          sessionId,
          requesterId: user.id,
          requesterEmail: user.email
        });

        if (result.success) {
          showUserToast('Session revoked successfully.');
          loadSessions();
          logAction('Session Revoked', sessionId);
        } else {
          showUserToast(result.message || 'Failed to revoke session.', true);
        }
      }
    });
  };

  const handleClearActivityLog = () => {
    setConfirmDialog({
      title: 'Clear activity log?',
      message: 'All admin activity records on this device will be removed. This cannot be undone.',
      confirmLabel: 'Clear logs',
      onConfirm: () => {
        setConfirmDialog(null);
        setActivityLog([]);
        showUserToast('Activity log cleared.');
      }
    });
  };

  const formatSessionTime = (value) => {
    const parsed = Date.parse(value || '');
    if (Number.isNaN(parsed)) return '-';
    return new Date(parsed).toLocaleString();
  };

  useEffect(() => {
    loadBooks();
    loadBorrowRecords();
    loadRecentActivity();
    loadStudentActivity();
    loadSignupSettings();
    loadPenaltySettings();
    loadAnnouncementSettings();
    loadSecurityLogs();
    loadSsoSettings();
    loadAdmin2faSettings();
  }, [loadSignupSettings, loadPenaltySettings, loadAnnouncementSettings, loadStudentActivity, loadSecurityLogs, loadSsoSettings, loadAdmin2faSettings, loadBorrowRecords, loadRecentActivity]);

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers();
    }
  }, [activeSection, loadUsers]);

  useEffect(() => {
    if (activeSection === 'home' || activeSection === 'circulation') {
      loadBorrowRecords();
      loadRecentActivity();
    }
  }, [activeSection, loadBorrowRecords, loadRecentActivity]);

  useEffect(() => {
    if (activeSection === 'settings') {
      loadSessions();
    }
  }, [activeSection, loadSessions]);

  useEffect(() => {
    setMessage('');
  }, [activeSection]);

  useEffect(() => {
    const syncStudentActivity = () => loadStudentActivity();
    window.addEventListener('storage', syncStudentActivity);
    window.addEventListener('focus', syncStudentActivity);
    return () => {
      window.removeEventListener('storage', syncStudentActivity);
      window.removeEventListener('focus', syncStudentActivity);
    };
  }, [loadStudentActivity]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile]);

  useEffect(() => {
    const tick = () => {
      try {
        setPhilTime(new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date()));
      } catch (error) {
        setPhilTime(new Date().toLocaleTimeString());
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sessionId = user?.session_id;
    if (!sessionId || !user?.id) return undefined;
    let isActive = true;

    const validateSession = async () => {
      const result = await api.validateSession({
        sessionId,
        requesterId: user.id,
        requesterEmail: user.email
      });

      if (!isActive) return;
      if (!result.success || !result.active) {
        clearAuth();
        navigate('/login', { replace: true });
      }
    };

    const touchSession = async () => {
      await api.touchSession({ sessionId });
    };

    validateSession();
    const interval = setInterval(touchSession, 60000);
    window.addEventListener('focus', validateSession);

    return () => {
      isActive = false;
      clearInterval(interval);
      window.removeEventListener('focus', validateSession);
    };
  }, [user?.id, user?.email, user?.session_id, navigate]);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [activeSection, isMobile]);

  useEffect(() => {
    setBookPage(1);
  }, [searchQuery, stockFilter]);

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
    if (!userToast) return undefined;
    const timeoutId = window.setTimeout(() => setUserToast(''), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [userToast]);

  useEffect(() => {
    if (!formVisible) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formVisible]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl('');
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [coverFile]);

  const summary = useMemo(() => {
    const totalTitles = books.length;
    const totalCopies = books.reduce((sum, book) => sum + getBookQuantity(book), 0);
    const availableCopies = books.reduce((sum, book) => sum + getBookAvailable(book), 0);
    const lowStock = books.filter(isLowStockBook).length;
    const outOfStock = books.filter((book) => getBookAvailable(book) === 0).length;
    return {
      totalTitles,
      totalCopies,
      availableCopies,
      borrowedCopies: Math.max(totalCopies - availableCopies, 0),
      lowStock,
      outOfStock
    };
  }, [books]);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      const matchesQuery = !query || (
        String(book.title || '').toLowerCase().includes(query) ||
        String(book.author || '').toLowerCase().includes(query) ||
        String(book.isbn || '').toLowerCase().includes(query) ||
        String(book.category || '').toLowerCase().includes(query)
      );

      if (!matchesQuery) return false;
      const available = getBookAvailable(book);
      if (stockFilter === 'low') return isLowStockBook(book);
      if (stockFilter === 'out') return available === 0;
      return true;
    });
  }, [books, searchQuery, stockFilter]);

  const bookPageCount = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PAGE_SIZE));
  const currentBookPage = Math.min(bookPage, bookPageCount);
  const paginatedBooks = useMemo(() => {
    const startIndex = (currentBookPage - 1) * BOOKS_PAGE_SIZE;
    return filteredBooks.slice(startIndex, startIndex + BOOKS_PAGE_SIZE);
  }, [filteredBooks, currentBookPage]);
  const pageStart = filteredBooks.length === 0 ? 0 : ((currentBookPage - 1) * BOOKS_PAGE_SIZE) + 1;
  const pageEnd = Math.min(currentBookPage * BOOKS_PAGE_SIZE, filteredBooks.length);

  const categorySummary = useMemo(() => {
    const counts = books.reduce((acc, book) => {
      const key = book.category || 'Uncategorized';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [books]);

  const lowStockBooks = useMemo(
    () => books.filter(isLowStockBook),
    [books]
  );

  const filteredActiveBorrows = useMemo(
    () => filterBorrowRecords(borrowRecords.active, activeBorrowSearch),
    [borrowRecords.active, activeBorrowSearch]
  );

  const filteredReturnedBooks = useMemo(
    () => filterBorrowRecords(borrowRecords.returned, returnedBookSearch),
    [borrowRecords.returned, returnedBookSearch]
  );

  const circulationToday = useMemo(() => {
    const issuedToday = borrowRecords.active.filter((record) => isRecordDateToday(record.borrowDate)).length;
    const returnedToday = borrowRecords.returned.filter((record) => isRecordDateToday(record.returnDate)).length;
    const overdueCount = borrowRecords.active.filter((record) => record.status === 'overdue').length;
    const dueTodayCount = borrowRecords.active.filter((record) => isRecordDateToday(record.dueDate)).length;
    return { issuedToday, returnedToday, overdueCount, dueTodayCount };
  }, [borrowRecords.active, borrowRecords.returned]);

  const dashboardInsights = useMemo(() => {
    const displayName = user.first_name || 'Admin';
    const lines = [];
    if (circulationToday.returnedToday > 0) {
      lines.push(`You processed ${circulationToday.returnedToday} return${circulationToday.returnedToday === 1 ? '' : 's'} today.`);
    }
    if (summary.lowStock > 0) {
      lines.push(`${summary.lowStock} title${summary.lowStock === 1 ? '' : 's'} need${summary.lowStock === 1 ? 's' : ''} restocking.`);
    }
    if (circulationToday.overdueCount === 0 && borrowRecordCounts.active > 0) {
      lines.push('All active loans are on schedule.');
    } else if (circulationToday.overdueCount > 0) {
      lines.push(`${circulationToday.overdueCount} loan${circulationToday.overdueCount === 1 ? '' : 's'} need follow-up.`);
    }
    if (lines.length === 0) {
      lines.push('Circulation is quiet — inventory and loans look healthy.');
    }
    return { greeting: getTimeGreeting(), displayName, lines };
  }, [user.first_name, circulationToday, summary.lowStock, borrowRecordCounts.active]);

  const handleQuickAddBook = () => {
    setActiveSection('books');
    setEditingId(null);
    setForm(emptyForm);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setFormVisible(true);
  };

  const scrollToSection = (sectionId) => {
    setActiveSection('circulation');
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

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

  const profileUserActivity = useMemo(() => {
    if (!selectedUserProfile?.id) return [];
    const targetId = Number(selectedUserProfile.id);
    return securityLogs.filter((entry) => {
      const details = entry.details || {};
      return Number(details.target_user_id) === targetId;
    }).slice(0, 8);
  }, [securityLogs, selectedUserProfile]);

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

  const showUserToast = (text, isError = false) => {
    if (!text) return;
    setUserToast(isError ? `❌ ${text}` : `✅ ${text}`);
  };

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

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setFormVisible(false);
  };

  const handleCoverFileChange = (event) => {
    const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setCoverFile(nextFile);
  };

  const handleQrFileChange = (event) => {
    const nextFile = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setQrFile(nextFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.author.trim()) {
      setBookFormStatus('Title and author are required.');
      setMessage('Title and author are required.');
      return;
    }

    setSaving(true);
    setBookFormStatus(coverFile ? 'Saving book and uploading cover...' : 'Saving book...');
    const selectedCoverFile = coverFile;
    const selectedQrFile = qrFile;
    const payload = {
      ...form,
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      category: form.category.trim(),
      intro: form.intro.trim(),
      quantity: Number(form.quantity || 1)
    };

    const isAddingBook = !editingId;
    const result = editingId
      ? await api.updateBook({ id: editingId, ...payload })
      : await api.addBook(payload);

    let combinedMessage = result.message || (result.success ? 'Saved.' : 'Failed to save.');
    let uploadFailed = false;
    const mediaSuccesses = [];
    if (result.success) {
      const targetBookId = editingId || Number(result.id || result.book_id || result.bookId || 0);
      if (targetBookId > 0) {
        if (selectedCoverFile) {
          setBookFormStatus('Uploading cover image...');
          const uploadResult = await api.uploadBookCover(targetBookId, selectedCoverFile);
          if (uploadResult.success) {
            mediaSuccesses.push('Cover uploaded');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `Cover upload failed: ${uploadResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        }

        if (selectedQrFile) {
          setBookFormStatus('Uploading QR image...');
          const uploadResult = await api.uploadBookQr(targetBookId, selectedQrFile);
          if (uploadResult.success) {
            mediaSuccesses.push('QR uploaded');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `QR upload failed: ${uploadResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        } else if (isAddingBook) {
          setBookFormStatus('Generating QR code...');
          const generateResult = await api.generateBookQr(targetBookId);
          if (generateResult.success) {
            mediaSuccesses.push('QR generated');
          } else {
            combinedMessage = appendStatusMessage(combinedMessage, `Book was added, but QR generation failed: ${generateResult.message || 'Unknown error'}`);
            uploadFailed = true;
          }
        }
      } else if (selectedCoverFile || selectedQrFile || isAddingBook) {
        uploadFailed = true;
        combinedMessage = appendStatusMessage(combinedMessage, 'Media upload skipped: the saved book ID was missing');
      }

      if (mediaSuccesses.length > 0) {
        combinedMessage = appendStatusMessage(combinedMessage, joinStatusParts(mediaSuccesses));
      }

      logAction(editingId ? 'Book Updated' : 'Book Added', payload.title);
      if (uploadFailed) {
        setBookFormStatus(combinedMessage);
      } else {
        resetForm();
      }
    } else {
      setBookFormStatus(combinedMessage);
    }
    setSaving(false);
    setMessage(combinedMessage);
    if (result.success) await loadBooks({ preserveMessage: true });
  };

  const handleEdit = (book) => {
    setEditingId(Number(book.id));
    setFormVisible(true);
    setForm({
      title: String(book.title || ''),
      author: String(book.author || ''),
      isbn: String(book.isbn || ''),
      category: String(book.category || ''),
      intro: String(book.intro || ''),
      quantity: getBookQuantity(book) || 1
    });
    setCoverFile(null);
    setCoverPreviewUrl('');
    setBookFormStatus('');
    setQrFile(null);
    setActiveSection('books');
  };

  const handleGenerateBookQr = async (book) => {
    const bookId = Number(book.id);
    if (!bookId || qrGeneratingId) return;

    setQrGeneratingId(bookId);
    const result = await api.generateBookQr(bookId);
    setQrGeneratingId(null);
    setMessage(result.message || (result.success ? 'QR generated.' : 'QR generation failed.'));
    if (result.success) {
      logAction('Book QR Generated', book.title);
      loadBooks();
    }
  };

  const handleArchive = async (id, title) => {
    const confirmed = window.confirm('Archive this book? It will be hidden from book lists but kept in the database.');
    if (!confirmed) return;

    const result = await api.archiveBook(id);
    setMessage(result.message || (result.success ? 'Book archived.' : 'Failed to archive book.'));
    if (result.success) {
      logAction('Book Archived', title);
      loadBooks();
    }
  };

  const handleRestock = async (book) => {
    const payload = {
      id: Number(book.id),
      title: book.title,
      author: book.author,
      isbn: book.isbn || '',
      category: book.category || '',
      quantity: getBookQuantity(book) + 1
    };
    const result = await api.updateBook(payload);
    setMessage(result.message || (result.success ? 'Book restocked.' : 'Restock failed.'));
    if (result.success) {
      logAction('Book Restocked', book.title);
      loadBooks();
    }
  };

  const handleExportCsv = () => {
    const header = ['Title', 'Author', 'ISBN', 'Category', 'Quantity', 'Available'];
    const rows = filteredBooks.map((book) => [
      `"${String(book.title || '').replace(/"/g, '""')}"`,
      `"${String(book.author || '').replace(/"/g, '""')}"`,
      `"${String(book.isbn || '').replace(/"/g, '""')}"`,
      `"${String(book.category || '').replace(/"/g, '""')}"`,
      getBookQuantity(book),
      getBookAvailable(book)
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'library-books.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logAction('Export', 'CSV exported');
  };

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const handleSignupVerificationToggle = async () => {
    const nextEnabled = !signupSettings.email_verification_enabled;
    setSignupSettingsSaving(true);

    const result = await api.updateSignupSettings({
      email_verification_enabled: nextEnabled
    });

    setSignupSettingsSaving(false);
    setMessage(result.message || (result.success ? 'Signup settings updated.' : 'Failed to update signup settings.'));

    if (result.success && result.settings) {
      setSignupSettings({
        email_verification_enabled: Boolean(result.settings.email_verification_enabled)
      });
      logAction(
        'Signup Email Verification',
        result.settings.email_verification_enabled ? 'Enabled' : 'Disabled'
      );
    }
  };

  const formatUserDate = (value) => {
    const parsed = Date.parse(value || '');
    if (Number.isNaN(parsed)) return '-';
    return new Date(parsed).toLocaleDateString();
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
  const renderHome = () => (
    <>
      <section className="admin-hero dashboard-home-section admin-hero-elevated" aria-labelledby="today-activity-title">
        <div className="admin-hero-top">
          <div>
            <p className="admin-hero-eyebrow">Operations overview</p>
            <h2 id="today-activity-title" className="admin-hero-title">Today&apos;s circulation</h2>
            <p className="admin-hero-subtitle admin-hero-greeting">
              {dashboardInsights.greeting}, {dashboardInsights.displayName} — {getManilaDateKey()}
            </p>
            <ul className="admin-hero-insights" aria-label="Today's summary">
              {dashboardInsights.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="admin-hero-actions">
            <button type="button" className="hero-action-btn" onClick={handleQuickAddBook}>
              <AdminNavIcon name="plus" /> Add book
            </button>
            <button type="button" className="hero-action-btn secondary" onClick={() => scrollToSection('active-borrows-section')}>
              <AdminNavIcon name="loan" /> Borrow / Return
            </button>
          </div>
        </div>
        <div className="admin-hero-metrics">
          <div className="hero-metric">
            <strong>{circulationToday.issuedToday}</strong>
            <span>Issued today</span>
            <small>New loans recorded today</small>
          </div>
          <div className="hero-metric">
            <strong>{circulationToday.returnedToday}</strong>
            <span>Returned today</span>
            <small>Completed returns today</small>
          </div>
          <div className={`hero-metric ${circulationToday.overdueCount > 0 ? 'is-alert' : 'is-healthy'}`}>
            <strong>{circulationToday.overdueCount}</strong>
            <span>Overdue alerts</span>
            <small>
              {circulationToday.overdueCount > 0
                ? 'Follow up with students today'
                : '✓ All borrowed books are on schedule'}
            </small>
          </div>
          <div className={`hero-metric ${summary.lowStock > 0 ? 'is-warning' : ''}`}>
            <strong>{summary.lowStock}</strong>
            <span>Low stock titles</span>
            <small>
              {summary.lowStock > 0
                ? '⚠ Restock recommended within 2 days'
                : 'Inventory levels look healthy'}
            </small>
          </div>
        </div>
      </section>

      <div className="summary-cards summary-cards-secondary dashboard-home-section">
        <div className="summary-card summary-card-neutral">
          <div className="card-icon"><AdminNavIcon name="books" /></div>
          <div className="card-info">
            <h3>{summary.totalTitles}</h3>
            <p>Total Titles</p>
            <span className="card-hint">Catalog size</span>
          </div>
        </div>
        <div className="summary-card summary-card-info">
          <div className="card-icon"><AdminNavIcon name="copies" /></div>
          <div className="card-info">
            <h3>{summary.totalCopies}</h3>
            <p>Total Copies</p>
            <span className="card-hint">All physical copies</span>
          </div>
        </div>
        <div className="summary-card summary-card-success">
          <div className="card-icon"><AdminNavIcon name="available" /></div>
          <div className="card-info">
            <h3>{summary.availableCopies}</h3>
            <p>Available Copies</p>
            <span className="card-hint">{summary.borrowedCopies} out on loan now</span>
          </div>
        </div>
        <div className="summary-card summary-card-danger">
          <div className="card-icon"><AdminNavIcon name="warning" /></div>
          <div className="card-info">
            <h3>{summary.lowStock}</h3>
            <p>Low Stock Titles</p>
            <span className="card-hint">Needs restocking soon</span>
          </div>
        </div>
        <div className="summary-card summary-card-warning">
          <div className="card-icon"><AdminNavIcon name="books" /></div>
          <div className="card-info">
            <h3>{borrowRecordCounts.active}</h3>
            <p>Currently Borrowed</p>
            <span className="card-hint">Active loans right now</span>
          </div>
        </div>
        <div className="summary-card summary-card-returns">
          <div className="card-icon"><AdminNavIcon name="activity" /></div>
          <div className="card-info">
            <h3>{borrowRecordCounts.returned}</h3>
            <p>All-Time Returns</p>
            <span className="card-hint">Completed returns (historical)</span>
          </div>
        </div>
      </div>
    </>
  );

  const renderCirculation = () => (
    <>
      <section className="circulation-stats dashboard-home-section" aria-label="Circulation summary">
        <div className="circulation-stat-cards">
          <article className="circulation-stat-card">
            <strong>{circulationToday.issuedToday}</strong>
            <span>Borrowed today</span>
            <small>New loans recorded today</small>
          </article>
          <article className={`circulation-stat-card ${circulationToday.overdueCount > 0 ? 'is-alert' : ''}`}>
            <strong>{circulationToday.overdueCount}</strong>
            <span>Overdue books</span>
            <small>{circulationToday.overdueCount > 0 ? 'Needs follow-up' : 'All loans on schedule'}</small>
          </article>
          <article className="circulation-stat-card">
            <strong>{borrowRecordCounts.active}</strong>
            <span>Active borrowers</span>
            <small>Currently out on loan</small>
          </article>
          <article className="circulation-stat-card">
            <strong>{circulationToday.returnedToday}</strong>
            <span>Returned today</span>
            <small>Completed returns today</small>
          </article>
          <article className={`circulation-stat-card ${summary.lowStock > 0 ? 'is-warning' : ''}`}>
            <strong>{summary.lowStock}</strong>
            <span>Low stock alerts</span>
            <small>{summary.lowStock > 0 ? 'Titles need restocking' : 'Inventory healthy'}</small>
          </article>
        </div>
      </section>

      <div className="circulation-top-grid dashboard-home-section">
        <section className="circulation-activity-panel admin-surface-card" aria-label="Recent activity">
          <div className="circulation-activity-header">
            <h3 className="circulation-section-heading">Recent activity</h3>
            <button
              type="button"
              className="circulation-activity-refresh"
              onClick={loadRecentActivity}
              disabled={recentActivityLoading}
            >
              {recentActivityLoading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
          {recentActivityLoading && recentActivity.length === 0 ? (
            <ul className="circulation-skeleton-list" aria-hidden="true">
              {[1, 2, 3, 4].map((slot) => (
                <li key={slot} className="circulation-skeleton-row" />
              ))}
            </ul>
          ) : recentActivityError ? (
            <p className="circulation-activity-status is-error">{recentActivityError}</p>
          ) : recentActivity.length === 0 ? (
            <p className="circulation-activity-status">No circulation activity yet.</p>
          ) : (
            <ul className="admin-activity-timeline circulation-activity-feed">
              {recentActivity.map((item) => (
                <li key={item.id} className={`admin-activity-card ${item.type}`}>
                  <span className={`activity-dot activity-dot-${item.type}`} aria-hidden="true" />
                  <div className="activity-card-body">
                    <p className="activity-card-headline">
                      <strong>{item.studentName}</strong> <span className="activity-card-action">{item.action}</span>
                    </p>
                    <p className="activity-card-book" title={item.title}>&ldquo;{item.title}&rdquo;</p>
                    <time className="activity-card-time">{item.timeAgo}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="circulation-quick-panel admin-surface-card" aria-label="Quick overview">
          <h3 className="circulation-section-heading">At a glance</h3>
          <ul className="circulation-quick-list">
            <li>
              <span className="circulation-quick-label">Due today</span>
              <strong className={circulationToday.dueTodayCount > 0 ? 'is-highlight' : ''}>
                {circulationToday.dueTodayCount}
              </strong>
            </li>
            <li>
              <span className="circulation-quick-label">Active loans</span>
              <strong>{borrowRecordCounts.active}</strong>
            </li>
            <li>
              <span className="circulation-quick-label">Overdue</span>
              <strong className={circulationToday.overdueCount > 0 ? 'is-alert-text' : ''}>
                {circulationToday.overdueCount}
              </strong>
            </li>
            <li>
              <span className="circulation-quick-label">Low stock</span>
              <strong className={summary.lowStock > 0 ? 'is-warning-text' : ''}>{summary.lowStock}</strong>
            </li>
          </ul>
          <div className="circulation-status-legend" aria-label="Status legend">
            <span><i className="legend-dot legend-dot-borrow" aria-hidden="true" /> Borrowed</span>
            <span><i className="legend-dot legend-dot-return" aria-hidden="true" /> Returned</span>
            <span><i className="legend-dot legend-dot-overdue" aria-hidden="true" /> Overdue</span>
          </div>
        </aside>
      </div>

      <div className="admin-borrow-panels dashboard-home-section admin-primary-grid">
        <div className="admin-borrow-panel admin-surface-card" id="active-borrows-section">
          <div className="section-heading-row">
            <SectionTitle icon="loan">Currently borrowed books</SectionTitle>
            <div className="section-heading-meta">
              <span className="admin-borrow-count">{borrowRecordCounts.active} active</span>
              <span className="admin-result-shown">{filteredActiveBorrows.length} shown</span>
            </div>
          </div>
          <div className="admin-table-toolbar">
            <input
              type="search"
              className="admin-table-search"
              placeholder="Search student or book..."
              value={activeBorrowSearch}
              onChange={(event) => setActiveBorrowSearch(event.target.value)}
              aria-label="Search active borrows"
            />
          </div>
          <div className={getBorrowTableContainerClass(filteredActiveBorrows.length, borrowRecordsLoading)}>
            <table className="activity-table admin-borrow-table">
              <thead>
                <tr>
                  <th className="col-student">Student</th>
                  <th className="col-book">Book</th>
                  <th className="col-date">Due</th>
                  <th className="col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {borrowRecordsLoading ? (
                  <>
                    {[1, 2, 3, 4].map((slot) => (
                      <tr key={slot} className="table-skeleton-row" aria-hidden="true">
                        <td colSpan={4}><span className="table-skeleton-bar" /></td>
                      </tr>
                    ))}
                  </>
                ) : filteredActiveBorrows.length > 0 ? (
                  filteredActiveBorrows.map((record) => (
                    <tr key={record.id}>
                      <td className="cell-student" title={record.studentName}>
                        <span className="table-cell-clamp">{record.studentName}</span>
                      </td>
                      <td className="cell-book" title={record.title}>
                        <span className="table-cell-clamp">{record.title}</span>
                      </td>
                      <td className="cell-date">{record.dueDate || '-'}</td>
                      <td className="cell-status">
                        <span className={`borrow-status ${record.status}`}>
                          {record.status === 'overdue' ? 'Overdue' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <AdminTableEmpty
                    icon="📖"
                    title={activeBorrowSearch ? 'No matching borrows' : 'No active borrows'}
                    message={activeBorrowSearch
                      ? 'Try a different search term or clear the filter.'
                      : 'No students currently have borrowed books. New loans will appear here.'}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-borrow-panel admin-surface-card" id="returns-section">
          <div className="section-heading-row">
            <SectionTitle icon="returnBook">Recently returned books</SectionTitle>
            <div className="section-heading-meta">
              <span className="admin-borrow-count">{borrowRecordCounts.returned} all-time</span>
              <span className="admin-result-shown">{filteredReturnedBooks.length} shown</span>
            </div>
          </div>
          <div className="admin-table-toolbar">
            <input
              type="search"
              className="admin-table-search"
              placeholder="Search student or book..."
              value={returnedBookSearch}
              onChange={(event) => setReturnedBookSearch(event.target.value)}
              aria-label="Search returned books"
            />
          </div>
          <div className={getBorrowTableContainerClass(filteredReturnedBooks.length, borrowRecordsLoading)}>
            <table className="activity-table admin-borrow-table">
              <thead>
                <tr>
                  <th className="col-student">Student</th>
                  <th className="col-book">Book</th>
                  <th className="col-date">Returned</th>
                  <th className="col-status">Penalty</th>
                </tr>
              </thead>
              <tbody>
                {borrowRecordsLoading ? (
                  <>
                    {[1, 2, 3, 4].map((slot) => (
                      <tr key={slot} className="table-skeleton-row" aria-hidden="true">
                        <td colSpan={4}><span className="table-skeleton-bar" /></td>
                      </tr>
                    ))}
                  </>
                ) : filteredReturnedBooks.length > 0 ? (
                  filteredReturnedBooks.map((record) => (
                    <tr key={record.id}>
                      <td className="cell-student" title={record.studentName}>
                        <span className="table-cell-clamp">{record.studentName}</span>
                      </td>
                      <td className="cell-book" title={record.title}>
                        <span className="table-cell-clamp">{record.title}</span>
                      </td>
                      <td className="cell-date">{record.returnDate || '-'}</td>
                      <td className="cell-status">{renderPenaltyCell(record)}</td>
                    </tr>
                  ))
                ) : (
                  <AdminTableEmpty
                    icon="✅"
                    title={returnedBookSearch ? 'No matching returns' : 'No returns yet'}
                    message={returnedBookSearch
                      ? 'Try a different search term or clear the filter.'
                      : 'Completed book returns will appear here once students return items.'}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-borrow-panel admin-surface-card low-stock-section dashboard-home-section" id="low-stock-section">
        <div className="section-heading-row">
          <SectionTitle icon="warning">Low stock books</SectionTitle>
          <span className="admin-borrow-count is-warning">{summary.lowStock} need attention</span>
        </div>
        <div className={getBorrowTableContainerClass(lowStockBooks.length, false)}>
          <table className="activity-table admin-borrow-table">
            <thead>
              <tr>
                <th className="col-book">Title</th>
                <th className="col-date">Category</th>
                <th className="col-status">Available</th>
                <th className="col-status">Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStockBooks.slice(0, 6).map((book) => (
                <tr key={book.id} className="low-stock-row">
                  <td className="cell-book" title={book.title}>
                    <span className="table-cell-clamp">{book.title}</span>
                  </td>
                  <td className="cell-truncate">{book.category || '-'}</td>
                  <td className="cell-date">{getBookAvailable(book)}</td>
                  <td>
                    <button type="button" className="table-action-btn table-action-btn-warning" onClick={() => handleRestock(book)}>
                      <AdminNavIcon name="warning" /> Restock soon
                    </button>
                  </td>
                </tr>
              ))}
              {lowStockBooks.length === 0 && (
                <AdminTableEmpty
                  colSpan={4}
                  icon="✨"
                  title="Inventory looks healthy"
                  message="No low stock titles right now. Books with limited copies will show here."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderBooks = () => (
    <>
      <div className="admin-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <div className="stock-filter-group" aria-label="Stock filter">
          {[
            ['all', 'All Stock'],
            ['low', 'Low Stock'],
            ['out', 'Out of Stock']
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-chip ${stockFilter === value ? 'active' : ''}`}
              onClick={() => setStockFilter(value)}
              aria-pressed={stockFilter === value}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="action-btn" onClick={handleExportCsv}>Export CSV</button>
        {!formVisible && (
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setCoverFile(null);
              setCoverPreviewUrl('');
              setBookFormStatus('');
              setQrFile(null);
              setFormVisible(true);
            }}
          >
            Add New Book
          </button>
        )}
      </div>

      <div className="admin-grid single-column">
        <div className="content-section inventory-section">
          <div className="section-heading-row">
            <h3 className="section-title">Books Inventory</h3>
          </div>
          <div className="table-container">
            <table className="activity-table book-inventory-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th className="numeric-cell">Qty</th>
                  <th className="numeric-cell">Avail</th>
                  <th className="media-cell">Cover</th>
                  <th className="media-cell">QR</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="no-results">Loading...</td></tr>
                ) : filteredBooks.length > 0 ? (
                  paginatedBooks.map((book) => (
                    <tr key={book.id} className={isLowStockBook(book) ? 'low-stock-row' : ''}>
                      <td>{book.title}</td>
                      <td>{book.author}</td>
                      <td>{book.category || '-'}</td>
                      <td className="numeric-cell">{getBookQuantity(book)}</td>
                      <td className="numeric-cell">
                        <span className={getStockBadgeClass(book)}>
                          {getBookAvailable(book)}
                        </span>
                      </td>
                      <td className="media-cell">
                        {book.cover_image_url ? (
                          <img
                            src={book.cover_image_url}
                            alt={`${book.title} cover`}
                            className="book-cover-thumb"
                          />
                        ) : '-'}
                      </td>
                      <td className="media-cell">
                        {book.qr_image_url ? (
                          <img
                            src={book.qr_image_url}
                            alt={`${book.title} QR`}
                            className="book-qr-thumb"
                          />
                        ) : '-'}
                      </td>
                      <td className="book-actions-cell">
                        <div className="book-actions">
                          <button type="button" className="table-btn icon-btn" onClick={() => handleEdit(book)} title="Edit book" aria-label={`Edit ${book.title}`}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="table-btn icon-btn"
                            onClick={() => handleGenerateBookQr(book)}
                            disabled={qrGeneratingId === Number(book.id)}
                            title={book.qr_image_url ? 'Regenerate QR' : 'Generate QR'}
                            aria-label={`${book.qr_image_url ? 'Regenerate QR for' : 'Generate QR for'} ${book.title}`}
                          >
                            {qrGeneratingId === Number(book.id) ? '...' : 'QR'}
                          </button>
                          <button type="button" className="table-btn icon-btn" onClick={() => handleRestock(book)} title="Add one copy" aria-label={`Add one copy to ${book.title}`}>
                            +1
                          </button>
                          <details className="row-action-menu">
                            <summary aria-label={`More actions for ${book.title}`}>More</summary>
                            <button type="button" className="menu-action danger" onClick={() => handleArchive(book.id, book.title)}>Archive</button>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="8" className="no-results">No books found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredBooks.length > 0 && (
            <div className="table-footer">
              <span>Showing {pageStart}-{pageEnd} of {filteredBooks.length} books</span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => setBookPage((page) => Math.max(1, page - 1))}
                  disabled={currentBookPage === 1}
                >
                  Previous
                </button>
                <span>Page {currentBookPage} of {bookPageCount}</span>
                <button
                  type="button"
                  className="table-btn"
                  onClick={() => setBookPage((page) => Math.min(bookPageCount, page + 1))}
                  disabled={currentBookPage === bookPageCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {formVisible && (
        <div
          className="book-form-modal-backdrop"
          onClick={() => {
            if (!saving) resetForm();
          }}
          role="presentation"
        >
          <div className="content-section book-form-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="section-title">{editingId ? 'Edit Book' : 'Add Book'}</h3>
            <form className="book-form" onSubmit={handleSubmit}>
              <input type="text" placeholder="Title" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
              <input type="text" placeholder="Author" value={form.author} onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))} />
              <input type="text" placeholder="ISBN" value={form.isbn} onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))} />
              <input type="text" placeholder="Category" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} />
              <textarea
                placeholder="Book summary / intro"
                value={form.intro}
                onChange={(e) => setForm((prev) => ({ ...prev, intro: e.target.value }))}
                rows={4}
              />
              <input type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))} />
              <div className="file-picker">
                <label htmlFor={`${editingId ? 'edit' : 'add'}-book-cover-upload-${editingId || 'new'}`} className="file-picker-label">Cover image</label>
                <input
                  id={`${editingId ? 'edit' : 'add'}-book-cover-upload-${editingId || 'new'}`}
                  className="file-picker-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  onChange={handleCoverFileChange}
                />
                <span className="file-picker-note">
                  {coverFile
                    ? `${coverFile.name} selected`
                    : 'No cover image chosen'}
                </span>
                {coverPreviewUrl && (
                  <img className="cover-file-preview" src={coverPreviewUrl} alt="Selected cover preview" />
                )}
              </div>
              <div className="file-picker">
                <label htmlFor={`${editingId ? 'edit' : 'add'}-book-qr-upload-${editingId || 'new'}`} className="file-picker-label">QR image</label>
                <input
                  id={`${editingId ? 'edit' : 'add'}-book-qr-upload-${editingId || 'new'}`}
                  className="file-picker-input"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg"
                  onChange={handleQrFileChange}
                />
                <span className="file-picker-note">
                  {qrFile
                    ? `${qrFile.name} selected`
                    : 'No QR image chosen'}
                </span>
              </div>
              {!editingId && (
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>
                  A QR code will be generated automatically when no QR image is uploaded.
                </p>
              )}
              {editingId && (
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: 0 }}>
                  Leave files empty to keep existing cover and QR images.
                </p>
              )}
              {bookFormStatus && (
                <div
                  className={`book-form-status ${bookFormStatus.toLowerCase().includes('failed') ? 'error' : ''}`}
                  role="status"
                >
                  {bookFormStatus}
                </div>
              )}
              <div className="form-actions">
                <button type="submit" className="action-btn" disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
                </button>
                <button type="button" className="action-btn danger" onClick={resetForm} disabled={saving}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  const renderAnalytics = () => (
    <div className="content-section">
      <h3 className="section-title">Category Breakdown</h3>
      <div className="table-container">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Titles</th>
            </tr>
          </thead>
          <tbody>
            {categorySummary.map(([name, count]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{count}</td>
              </tr>
            ))}
            {categorySummary.length === 0 && (
              <tr><td colSpan="2" className="no-results">No category data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderActivity = () => (
    <>
      <div className="content-section">
        <h3 className="section-title">Recent Admin Actions</h3>
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Action</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.length > 0 ? activityLog.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.adminName || user.email || 'Admin'}</td>
                  <td>{entry.action}</td>
                  <td>{entry.details}</td>
                  <td>{entry.time}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="no-results">No admin actions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="content-section">
        <h3 className="section-title">Security Audit Logs</h3>
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Event</th>
                <th>IP</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {securityLogsLoading ? (
                <tr><td colSpan="4" className="no-results">Loading security logs...</td></tr>
              ) : securityLogs.length > 0 ? securityLogs.slice(0, 50).map((entry, idx) => (
                <tr key={`${entry.time || 'time'}-${entry.event || 'event'}-${idx}`}>
                  <td>{entry.admin_name || entry.adminName || 'Admin'}</td>
                  <td>{String(entry.event || '-').replace(/_/g, ' ')}</td>
                  <td>{entry.ip || '-'}</td>
                  <td>{entry.time || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" className="no-results">No security logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const renderStudentLogs = () => (
    <div className="content-section">
      <h3 className="section-title">Recent Student Activity</h3>
      <div className="table-container">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Action</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {studentActivityLog.length > 0 ? studentActivityLog.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.user}</td>
                <td>{entry.action}</td>
                <td>{entry.details}</td>
                <td>{entry.time}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="no-results">No student activity yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => (
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
        <button type="button" className="action-btn users-refresh-btn" onClick={loadUsers} disabled={usersLoading}>
          <span className={`refresh-icon ${usersLoading ? 'is-spinning' : ''}`} aria-hidden="true">
            <AdminNavIcon name="refresh" />
          </span>
          <span>{usersLoading ? 'Loading...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="admin-grid single-column">
        <div className="content-section users-section">
          <h3 className="section-title">Registered Users</h3>
          <div className="table-container users-table-container">
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

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return sessions.filter((session) => {
      const isRevoked = Boolean(session.revoked_at);
      if (sessionStatusFilter === 'active' && isRevoked) return false;
      if (sessionStatusFilter === 'revoked' && !isRevoked) return false;
      if (!query) return true;
      const device = parseSessionAgent(session.user_agent);
      return (
        String(session.email || '').toLowerCase().includes(query)
        || String(session.ip || '').includes(query)
        || device.browser.toLowerCase().includes(query)
        || device.os.toLowerCase().includes(query)
      );
    });
  }, [sessions, sessionSearch, sessionStatusFilter]);

  const settingsSummary = useMemo(() => {
    const activeSessions = sessions.filter((session) => !session.revoked_at);
    const failedLogins = securityLogs.filter((entry) => {
      const event = String(entry.event || '').toLowerCase();
      return event.includes('fail') || event.includes('denied');
    }).length;

    return {
      activeSessions: activeSessions.length,
      studentsOnline: activeSessions.filter((session) => session.role === 'student').length,
      overdueBooks: lowStockBooks.length,
      failedLogins
    };
  }, [sessions, securityLogs, lowStockBooks]);

  const renderSettings = () => {
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


  return (
    <div className="admin-dashboard-container">
      <header className="admin-dashboard-header">
        <div className="header-left">
          <button className="hamburger-btn" onClick={() => setSidebarOpen((prev) => !prev)}>☰</button>
          <div className="header-title-block">
            <h1 className="page-title">{getPageTitle()}</h1>
            {activeSection === 'circulation' && (
              <p className="page-subtitle">Monitor loans, returns, and inventory alerts in real time</p>
            )}
          </div>
        </div>
        <div className="header-right">
          <div className="philippine-time" title="Philippine Time (Asia/Manila)">{philTime}</div>
          <button
            type="button"
            className="action-btn header-refresh-btn"
            onClick={() => {
              loadBooks();
              loadBorrowRecords();
              loadRecentActivity();
            }}
          >
            <AdminNavIcon name="refresh" />
            <span>Refresh</span>
          </button>
          <button type="button" className="action-btn header-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="admin-sidebar-profile">
            <div className="admin-sidebar-avatar" aria-hidden="true">CV</div>
            <div className="admin-sidebar-identity">
              <div className="admin-sidebar-title-row">
                <span className="admin-sidebar-title">Library Admin</span>
                <span className="admin-sidebar-role">{user.role || 'admin'}</span>
              </div>
              <span className="admin-sidebar-name">
                {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Admin user'}
              </span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${item.parentId ? 'nav-item-sub' : ''} ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="nav-icon"><AdminNavIcon name={item.icon} /></span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        {isMobile && sidebarOpen && <button type="button" className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar" />}

        <main className="main-content">
          <div className="content-wrapper">
            {message && <div className="dashboard-message">{message}</div>}
            {activeSection === 'home' && renderHome()}
            {activeSection === 'books' && renderBooks()}
            {activeSection === 'circulation' && renderCirculation()}
            {activeSection === 'analytics' && renderAnalytics()}
            {activeSection === 'activity' && renderActivity()}
            {activeSection === 'student-logs' && renderStudentLogs()}
            {activeSection === 'users' && renderUsers()}
            {activeSection === 'settings' && renderSettings()}
          </div>
        </main>
      </div>

      {userToast && <div className="user-toast" role="status">{userToast}</div>}

      {userActionMenu && (
        <>
          <button
            type="button"
            className="action-menu-backdrop"
            aria-label="Close actions menu"
            onClick={() => setUserActionMenu(null)}
          />
          <div
            className="action-menu-panel user-action-panel is-floating"
            style={{ top: `${userActionMenu.top}px`, left: `${userActionMenu.left}px` }}
            role="menu"
          >
            {(() => {
              const entry = userActionMenu.entry;
              const isSelf = Number(entry.id) === Number(user.id || 0);
              const isSaving = userRoleSavingId === entry.id;

              return (
                <>
                  <button type="button" className="menu-action-item" role="menuitem" onClick={() => { setUserActionMenu(null); openUserProfile(entry); }}>
                    View Profile
                  </button>
                  <button type="button" className="menu-action-item" role="menuitem" onClick={() => { setUserActionMenu(null); openUserProfile(entry); }}>
                    Edit User
                  </button>
                  <div className="menu-action-divider" role="separator" />
                  <button
                    type="button"
                    className="menu-action-item"
                    role="menuitem"
                    disabled={entry.role === 'admin' || isSaving}
                    onClick={() => { setUserActionMenu(null); requestRoleChange(entry, 'admin'); }}
                  >
                    Promote to Admin
                  </button>
                  <button
                    type="button"
                    className="menu-action-item"
                    role="menuitem"
                    disabled={entry.role === 'student' || isSaving || (isSelf && entry.role === 'admin')}
                    onClick={() => { setUserActionMenu(null); requestRoleChange(entry, 'student'); }}
                  >
                    Demote to Student
                  </button>
                  <div className="menu-action-divider" role="separator" />
                  <button
                    type="button"
                    className="menu-action-item"
                    role="menuitem"
                    onClick={() => {
                      setUserActionMenu(null);
                      requestPendingAdminAction('Reset password?', `Send a password reset for ${entry.email}?`);
                    }}
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    className="menu-action-item"
                    role="menuitem"
                    onClick={() => {
                      setUserActionMenu(null);
                      requestPendingAdminAction('Suspend user?', `Suspend ${formatDisplayName(entry)}? They will lose access until reactivated.`);
                    }}
                  >
                    Suspend User
                  </button>
                  <button
                    type="button"
                    className="menu-action-item danger"
                    role="menuitem"
                    onClick={() => {
                      setUserActionMenu(null);
                      requestPendingAdminAction('Delete user?', `Permanently delete ${formatDisplayName(entry)}? This cannot be undone.`);
                    }}
                  >
                    Delete User
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

      {selectedUserProfile && (
        <div className="confirm-modal-overlay profile-overlay" role="presentation" onClick={() => setSelectedUserProfile(null)}>
          <div
            className="user-profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-profile-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="user-profile-header">
              <div className="user-profile-identity">
                <span className={`user-avatar large ${getRoleBadgeClass(selectedUserProfile)}`}>
                  {getUserInitials(selectedUserProfile)}
                </span>
                <div>
                  <h4 id="user-profile-title">{formatDisplayName(selectedUserProfile)}</h4>
                  <p>{selectedUserProfile.email}</p>
                  <span className={`role-pill ${getRoleBadgeClass(selectedUserProfile)}`}>
                    <UserRoleIcon role={selectedUserProfile.role} affiliation={selectedUserProfile.affiliation} />
                    {getRoleLabel(selectedUserProfile)}
                  </span>
                </div>
              </div>
              <button type="button" className="profile-close-btn" onClick={() => setSelectedUserProfile(null)} aria-label="Close profile">
                ×
              </button>
            </div>

            <div className="profile-tabs" role="tablist" aria-label="User profile sections">
              <button type="button" role="tab" className={profileTab === 'overview' ? 'active' : ''} onClick={() => setProfileTab('overview')}>Overview</button>
              <button type="button" role="tab" className={profileTab === 'borrowing' ? 'active' : ''} onClick={() => setProfileTab('borrowing')}>Borrowing</button>
              <button type="button" role="tab" className={profileTab === 'activity' ? 'active' : ''} onClick={() => setProfileTab('activity')}>Activity</button>
            </div>

            {profileTab === 'overview' && (
              <>
                <div className="user-profile-grid">
                  <div className="profile-field">
                    <span>Affiliation</span>
                    <strong>{selectedUserProfile.affiliation || '-'}</strong>
                  </div>
                  <div className="profile-field">
                    <span>Institution ID</span>
                    <strong>{selectedUserProfile.institution_id || '-'}</strong>
                  </div>
                  <div className="profile-field">
                    <span>Joined</span>
                    <strong>{formatUserDate(selectedUserProfile.created_at)}</strong>
                  </div>
                  <div className="profile-field">
                    <span>Account Status</span>
                    <strong className="status-active">Active</strong>
                  </div>
                </div>

                <div className="user-profile-section">
                  <h5>Admin Notes</h5>
                  <textarea
                    className="profile-notes-input"
                    rows={3}
                    placeholder="Internal notes visible only to admins..."
                    value={profileAdminNotes[selectedUserProfile.id] || ''}
                    onChange={(event) => saveProfileAdminNote(selectedUserProfile.id, event.target.value)}
                  />
                </div>

                <div className="user-profile-section">
                  <h5>Recent Sessions</h5>
                  {profileSessionsLoading ? (
                    <p className="profile-muted">Loading sessions...</p>
                  ) : profileSessions.length > 0 ? (
                    <ul className="profile-session-list">
                      {profileSessions.slice(0, 4).map((session) => (
                        <li key={session.id}>
                          <span>{String(session.user_agent || 'Unknown device').slice(0, 64)}</span>
                          <small>
                            {session.revoked_at ? 'Revoked' : 'Active'}
                            {' · '}
                            {formatUserDate(session.last_seen_at || session.created_at)}
                          </small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="profile-muted">No session history available.</p>
                  )}
                </div>
              </>
            )}

            {profileTab === 'borrowing' && (
              <div className="user-profile-section">
                <h5>Borrowing History</h5>
                {profileBorrowsLoading ? (
                  <p className="profile-muted">Loading borrowing records...</p>
                ) : profileBorrows.length > 0 ? (
                  <ul className="profile-borrow-list">
                    {profileBorrows.map((borrow) => (
                      <li key={borrow.id}>
                        <div className="borrow-row-top">
                          <strong>{borrow.title}</strong>
                          <span className={`borrow-status ${borrow.status}`}>{borrow.status}</span>
                        </div>
                        <small>
                          Borrowed {borrow.borrowDate || '-'}
                          {borrow.dueDate ? ` · Due ${borrow.dueDate}` : ''}
                          {borrow.returnDate ? ` · Returned ${borrow.returnDate}` : ''}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profile-muted">No borrowing records found for this user.</p>
                )}
              </div>
            )}

            {profileTab === 'activity' && (
              <div className="user-profile-section">
                <h5>Admin Activity Timeline</h5>
                {profileUserActivity.length > 0 ? (
                  <ul className="profile-activity-list">
                    {profileUserActivity.map((entry, index) => (
                      <li key={`${entry.timestamp || entry.time}-${index}`}>
                        <span className="activity-chip">{entry.event || 'update'}</span>
                        <p>{entry.admin_name || 'Admin'} updated this account</p>
                        <small>{entry.time || '-'}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profile-muted">No admin activity logged for this user yet.</p>
                )}
              </div>
            )}

            <div className="user-profile-actions">
              <button
                type="button"
                className="table-btn"
                onClick={() => {
                  const target = selectedUserProfile;
                  setSelectedUserProfile(null);
                  requestRoleChange(target, target.role === 'admin' ? 'student' : 'admin');
                }}
                disabled={Number(selectedUserProfile.id) === Number(user.id || 0) && selectedUserProfile.role === 'admin'}
              >
                {selectedUserProfile.role === 'admin' ? 'Demote to Student' : 'Promote to Admin'}
              </button>
              <button type="button" className="table-btn" onClick={() => setSelectedUserProfile(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="confirm-modal-overlay" role="presentation" onClick={() => setConfirmDialog(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 id="confirm-dialog-title">{confirmDialog.title}</h4>
            <p>{confirmDialog.message}</p>
            <div className="confirm-modal-actions">
              <button type="button" className="table-btn" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button
                type="button"
                className="table-btn danger"
                onClick={() => confirmDialog.onConfirm?.()}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

