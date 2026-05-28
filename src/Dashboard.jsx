import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userRoleSavingId, setUserRoleSavingId] = useState(null);
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
    { id: 'home', icon: '📊', label: 'Dashboard' },
    { id: 'books', icon: '📚', label: 'Manage Books' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'activity', icon: '🕒', label: 'Admin Activity' },
    { id: 'student-logs', icon: '🧾', label: 'Student Logs' },
    { id: 'users', icon: '👥', label: 'Manage Users' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ];

  const getPageTitle = () => {
    if (activeSection === 'books') return 'BOOK MANAGEMENT';
    if (activeSection === 'analytics') return 'LIBRARY ANALYTICS';
    if (activeSection === 'activity') return 'ADMIN ACTIVITY LOG';
    if (activeSection === 'student-logs') return 'STUDENT ACTIVITY LOGS';
    if (activeSection === 'users') return 'USER MANAGEMENT';
    if (activeSection === 'settings') return 'ADMIN SETTINGS';
    return 'ADMIN DASHBOARD HOME';
  };

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
    const result = await api.getUsers({ requesterId: user.id, requesterEmail: user.email });
    if (result.success) {
      setUsers(Array.isArray(result.users) ? result.users : []);
    } else {
      setMessage(result.message || 'Failed to load users.');
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
    setAdmin2faSaving(true);
    const result = await api.updateAdmin2faSettings({
      enabled: nextEnabled
    });
    setAdmin2faSaving(false);

    if (result.success && result.settings) {
      setAdmin2faSettings({ enabled: Boolean(result.settings.enabled) });
      setMessage(result.message || 'Admin 2FA settings updated.');
      logAction('Admin 2FA', result.settings.enabled ? 'Enabled' : 'Disabled');
    } else {
      setMessage(result.message || 'Failed to update admin 2FA.');
    }
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
      setMessage(result.message || 'Penalty settings updated.');
      logAction('Penalty Settings', 'Updated');
    } else {
      setMessage(result.message || 'Failed to update penalty settings.');
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
    setMessage(result.message || (result.success ? 'Announcement settings updated.' : 'Failed to update announcement settings.'));

    if (result.success && result.settings) {
      setAnnouncementSettings({
        enabled: Boolean(result.settings.enabled),
        title: result.settings.title || 'Library Notice',
        message: result.settings.message || ''
      });
      logAction('Announcement Settings', result.settings.enabled ? 'Enabled' : 'Disabled');
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

  const handleRevokeSession = async (sessionId) => {
    if (!sessionId) return;
    const confirmed = window.confirm('Revoke this session?');
    if (!confirmed) return;

    const result = await api.revokeSession({
      sessionId,
      requesterId: user.id,
      requesterEmail: user.email
    });

    setMessage(result.message || (result.success ? 'Session revoked.' : 'Failed to revoke session.'));
    if (result.success) {
      loadSessions();
      logAction('Session Revoked', sessionId);
    }
  };

  const formatSessionTime = (value) => {
    const parsed = Date.parse(value || '');
    if (Number.isNaN(parsed)) return '-';
    return new Date(parsed).toLocaleString();
  };

  useEffect(() => {
    loadBooks();
    loadStudentActivity();
    loadSignupSettings();
    loadPenaltySettings();
    loadAnnouncementSettings();
    loadSecurityLogs();
    loadSsoSettings();
    loadAdmin2faSettings();
  }, [loadSignupSettings, loadPenaltySettings, loadAnnouncementSettings, loadStudentActivity, loadSecurityLogs, loadSsoSettings, loadAdmin2faSettings]);

  useEffect(() => {
    if (activeSection === 'users') {
      loadUsers();
    }
  }, [activeSection, loadUsers]);

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

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
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
      return true;
    });
  }, [users, userSearch, userRoleFilter]);

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

  const handleRoleChange = async (targetUser, nextRole) => {
    if (!targetUser || targetUser.role === nextRole || userRoleSavingId) return;

    const isSelf = Number(targetUser.id) === Number(user.id || 0);
    const warning = isSelf && nextRole !== 'admin'
      ? 'You are about to remove your own admin access. You may lose access to the admin dashboard. Continue?'
      : `Update ${targetUser.email} role to ${nextRole}?`;

    if (!window.confirm(warning)) return;

    setUserRoleSavingId(targetUser.id);
    const result = await api.updateUserRole({
      id: targetUser.id,
      role: nextRole,
      requester_id: user.id,
      requester_email: user.email
    });
    setUserRoleSavingId(null);

    setMessage(result.message || (result.success ? 'User role updated.' : 'Failed to update role.'));
    if (result.success) {
      setUsers((prev) => prev.map((entry) => (
        Number(entry.id) === Number(targetUser.id) ? { ...entry, role: nextRole } : entry
      )));
      logAction('User Role Updated', `${targetUser.email} -> ${nextRole}`);
      if (isSelf) {
        updateStoredUser({ role: nextRole });
      }
    }
  };
  const renderHome = () => (
    <>
      <div className="admin-welcome-card">
        <div className="welcome-info">
          <h2>Welcome, {user.first_name} {user.last_name}</h2>
          <p>Role: {user.role || 'admin'}</p>
          <p className="user-email">{user.email}</p>
        </div>
        <div className="welcome-avatar">
          <span>{user.first_name?.charAt(0)}{user.last_name?.charAt(0)}</span>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">📚</div>
          <div className="card-info"><h3>{summary.totalTitles}</h3><p>Total Titles</p></div>
        </div>
        <div className="summary-card borrowed">
          <div className="card-icon">📦</div>
          <div className="card-info"><h3>{summary.totalCopies}</h3><p>Total Copies</p></div>
        </div>
        <div className="summary-card returned">
          <div className="card-icon">✅</div>
          <div className="card-info"><h3>{summary.availableCopies}</h3><p>Available</p></div>
        </div>
        <div className="summary-card overdue">
          <div className="card-icon">⚠️</div>
          <div className="card-info"><h3>{summary.lowStock}</h3><p>Low Stock</p></div>
        </div>
      </div>

      <div className="content-section">
        <h3 className="section-title">Low Stock Books</h3>
        <div className="table-container">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Available</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {lowStockBooks.slice(0, 6).map((book) => (
                <tr key={book.id}>
                  <td>{book.title}</td>
                  <td>{book.category || '-'}</td>
                  <td>{getBookAvailable(book)}</td>
                  <td>
                    <button type="button" className="action-btn" onClick={() => handleRestock(book)}>Restock +1</button>
                  </td>
                </tr>
              ))}
              {lowStockBooks.length === 0 && (
                <tr><td colSpan="4" className="no-results">No low stock books</td></tr>
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
      <div className="admin-controls">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search users..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>
        <select
          className="filter-select"
          value={userRoleFilter}
          onChange={(e) => setUserRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admins</option>
          <option value="student">Students</option>
        </select>
        <button type="button" className="action-btn" onClick={loadUsers}>Refresh</button>
      </div>

      <div className="admin-grid single-column">
        <div className="content-section">
          <h3 className="section-title">Registered Users</h3>
          <div className="table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Affiliation</th>
                  <th>Institution ID</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan="7" className="no-results">Loading...</td></tr>
                ) : filteredUsers.length > 0 ? (
                  filteredUsers.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.first_name} {entry.last_name}</td>
                      <td>{entry.email}</td>
                      <td>
                        <span className={`role-pill ${entry.role === 'admin' ? 'admin' : 'student'}`}>
                          {entry.role}
                        </span>
                      </td>
                      <td>{entry.affiliation || '-'}</td>
                      <td>{entry.institution_id || '-'}</td>
                      <td>{formatUserDate(entry.created_at)}</td>
                      <td className="user-action-cell">
                        <button
                          type="button"
                          className="table-btn"
                          onClick={() => handleRoleChange(entry, 'admin')}
                          disabled={entry.role === 'admin' || userRoleSavingId === entry.id}
                        >
                          Make Admin
                        </button>
                        <button
                          type="button"
                          className="table-btn danger"
                          onClick={() => handleRoleChange(entry, 'student')}
                          disabled={entry.role === 'student' || userRoleSavingId === entry.id}
                        >
                          Make Student
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="7" className="no-results">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );

  const renderSettings = () => (
    <div className="content-section">
      <h3 className="section-title">Admin Settings</h3>
      <div className="settings-card">
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Clear Activity Log</p>
            <p className="setting-description">Remove all admin activity records.</p>
          </div>
          <button type="button" className="action-btn danger" onClick={() => setActivityLog([])}>Clear</button>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Refresh Library Data</p>
            <p className="setting-description">Reload latest data from server.</p>
          </div>
          <button type="button" className="action-btn" onClick={loadBooks}>Refresh</button>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Announcement</p>
            <p className="setting-description">
              {announcementSettingsLoading
                ? 'Loading announcement settings...'
                : announcementSettings.enabled
                  ? 'The current announcement is visible on the student dashboard.'
                  : 'The student announcement is currently hidden.'}
            </p>
          </div>
          <button
            type="button"
            className={`action-btn ${announcementSettings.enabled ? 'danger' : ''}`}
            onClick={handleAnnouncementToggle}
            disabled={announcementSettingsLoading || announcementSettingsSaving}
          >
            {announcementSettingsLoading
              ? 'Loading...'
              : announcementSettingsSaving
                ? 'Saving...'
                : announcementSettings.enabled
                  ? 'Hide'
                  : 'Show'}
          </button>
        </div>
        <div className="setting-subsection">
          <div className="setting-form-row">
            <label className="setting-field-label" htmlFor="announcement-title">Announcement title</label>
            <input
              id="announcement-title"
              className="setting-input"
              type="text"
              placeholder="Library Notice"
              value={announcementSettings.title}
              onChange={(event) => setAnnouncementSettings((prev) => ({
                ...prev,
                title: event.target.value
              }))}
              disabled={announcementSettingsLoading}
            />
          </div>
          <div className="setting-form-row">
            <label className="setting-field-label" htmlFor="announcement-message">Announcement message</label>
            <textarea
              id="announcement-message"
              className="setting-input setting-textarea"
              placeholder="Type the announcement shown to students..."
              rows={4}
              value={announcementSettings.message}
              onChange={(event) => setAnnouncementSettings((prev) => ({
                ...prev,
                message: event.target.value
              }))}
              disabled={announcementSettingsLoading}
            />
            <small className="setting-hint">This is the message students will see on their dashboard.</small>
          </div>
          <div className="setting-form-row">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={announcementSettings.enabled}
                onChange={(event) => setAnnouncementSettings((prev) => ({
                  ...prev,
                  enabled: event.target.checked
                }))}
                disabled={announcementSettingsLoading}
              />
              <span>Show announcement on student dashboard</span>
            </label>
          </div>
          <div className="setting-form-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleAnnouncementSettingsSave}
              disabled={announcementSettingsLoading || announcementSettingsSaving}
            >
              {announcementSettingsSaving ? 'Saving...' : 'Save announcement'}
            </button>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Penalty Rules</p>
            <p className="setting-description">
              {penaltySettingsLoading
                ? 'Loading penalty policy...'
                : `Grace: ${penaltySettings.grace_days} days, Fee: PHP ${penaltySettings.daily_fee} per day, Block after ${penaltySettings.block_overdue_days} days.`}
            </p>
          </div>
          <button
            type="button"
            className="action-btn"
            onClick={handlePenaltySettingsSave}
            disabled={penaltySettingsLoading || penaltySettingsSaving}
          >
            {penaltySettingsLoading ? 'Loading...' : penaltySettingsSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="setting-subsection">
          <div className="setting-form-row">
            <label className="setting-field-label" htmlFor="penalty-grace">Grace period (days)</label>
            <input
              id="penalty-grace"
              className="setting-input"
              type="number"
              min="0"
              value={penaltySettings.grace_days}
              onChange={(event) => setPenaltySettings((prev) => ({
                ...prev,
                grace_days: event.target.value
              }))}
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
              onChange={(event) => setPenaltySettings((prev) => ({
                ...prev,
                daily_fee: event.target.value
              }))}
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
              onChange={(event) => setPenaltySettings((prev) => ({
                ...prev,
                block_overdue_days: event.target.value
              }))}
              disabled={penaltySettingsLoading}
            />
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">SSO / LDAP</p>
            <p className="setting-description">
              {ssoSettingsLoading
                ? 'Loading SSO configuration...'
                : ssoSettings.enabled
                  ? 'SSO login is enabled for allowed domains.'
                  : 'SSO login is currently disabled.'}
            </p>
          </div>
          <button
            type="button"
            className={`action-btn ${ssoSettingsForm.enabled ? 'danger' : ''}`}
            onClick={handleSsoToggle}
            disabled={ssoSettingsLoading || ssoSettingsSaving}
          >
            {ssoSettingsLoading ? 'Loading...' : ssoSettingsSaving ? 'Saving...' : ssoSettingsForm.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
        <div className="setting-subsection">
          <div className="setting-form-row">
            <label className="setting-field-label" htmlFor="sso-provider">Provider label</label>
            <input
              id="sso-provider"
              className="setting-input"
              type="text"
              value={ssoSettingsForm.provider_name}
              onChange={(event) => setSsoSettingsForm((prev) => ({
                ...prev,
                provider_name: event.target.value
              }))}
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
              onChange={(event) => setSsoSettingsForm((prev) => ({
                ...prev,
                allowed_domains: event.target.value
              }))}
              disabled={ssoSettingsLoading}
            />
            <small className="setting-hint">Comma-separated list of email domains.</small>
          </div>
          <div className="setting-form-row">
            <label className="setting-checkbox">
              <input
                type="checkbox"
                checked={ssoSettingsForm.admin_only}
                onChange={(event) => setSsoSettingsForm((prev) => ({
                  ...prev,
                  admin_only: event.target.checked
                }))}
                disabled={ssoSettingsLoading}
              />
              <span>Restrict SSO to admin accounts only</span>
            </label>
          </div>
          <div className="setting-form-actions">
            <button
              type="button"
              className="action-btn"
              onClick={handleSsoSave}
              disabled={ssoSettingsLoading || ssoSettingsSaving}
            >
              {ssoSettingsSaving ? 'Saving...' : 'Save configuration'}
            </button>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Admin 2FA</p>
            <p className="setting-description">
              {admin2faLoading
                ? 'Loading admin 2FA status...'
                : admin2faSettings.enabled
                  ? 'Admin accounts must verify a 6-digit email code on login.'
                  : 'Admin 2FA is currently disabled.'}
            </p>
          </div>
          <button
            type="button"
            className={`action-btn ${admin2faSettings.enabled ? 'danger' : ''}`}
            onClick={handleAdmin2faToggle}
            disabled={admin2faLoading || admin2faSaving}
          >
            {admin2faLoading ? 'Loading...' : admin2faSaving ? 'Saving...' : admin2faSettings.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Session Management</p>
            <p className="setting-description">Manage active sessions and revoke devices from user security profile.</p>
          </div>
          <button
            type="button"
            className="action-btn"
            onClick={loadSessions}
            disabled={sessionsRefreshing}
          >
            {sessionsRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="setting-subsection">
          <div className="table-container">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>IP</th>
                  <th>Device</th>
                  <th>Last Seen</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessionsLoading ? (
                  <tr><td colSpan="7" className="no-results">Loading sessions...</td></tr>
                ) : sessions.length > 0 ? (
                  sessions.map((session) => {
                    const isRevoked = Boolean(session.revoked_at);
                    const isCurrent = session.id === user?.session_id;
                    const deviceLabel = String(session.user_agent || 'Unknown').slice(0, 48);
                    return (
                      <tr key={session.id}>
                        <td>{session.email || '-'}</td>
                        <td>
                          <span className={`role-pill ${session.role === 'admin' ? 'admin' : ''}`}>
                            {session.role || 'student'}
                          </span>
                        </td>
                        <td>{session.ip || '-'}</td>
                        <td title={session.user_agent || ''}>{deviceLabel}{deviceLabel.length >= 48 ? '…' : ''}</td>
                        <td>{formatSessionTime(session.last_seen_at)}</td>
                        <td>
                          <span className={`session-pill ${isRevoked ? 'revoked' : 'active'}`}>
                            {isCurrent && !isRevoked ? 'Current' : isRevoked ? 'Revoked' : 'Active'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="table-btn danger"
                            onClick={() => handleRevokeSession(session.id)}
                            disabled={isRevoked}
                          >
                            {isRevoked ? 'Revoked' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan="7" className="no-results">No sessions found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Refresh Security Logs</p>
            <p className="setting-description">Reload latest authentication security events.</p>
          </div>
          <button type="button" className="action-btn" onClick={loadSecurityLogs}>Refresh</button>
        </div>
        <div className="setting-item">
          <div className="setting-info">
            <p className="setting-label">Email Verification on Signup</p>
            <p className="setting-description">
              {signupSettingsLoading
                ? 'Loading signup verification setting...'
                : signupSettings.email_verification_enabled
                  ? 'Students must verify their email with an OTP before signup completes.'
                  : 'Students can sign up immediately without email verification.'}
            </p>
          </div>
          <button
            type="button"
            className={`action-btn ${signupSettings.email_verification_enabled ? '' : 'danger'}`}
            onClick={handleSignupVerificationToggle}
            disabled={signupSettingsLoading || signupSettingsSaving}
          >
            {signupSettingsLoading
              ? 'Loading...'
              : signupSettingsSaving
                ? 'Saving...'
                : signupSettings.email_verification_enabled
                  ? 'Disable'
                  : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-dashboard-container">
      <header className="admin-dashboard-header">
        <div className="header-left">
          <button className="hamburger-btn" onClick={() => setSidebarOpen((prev) => !prev)}>☰</button>
          <h1 className="page-title">{getPageTitle()}</h1>
        </div>
        <div className="header-right">
          <div className="philippine-time" title="Philippine Time (Asia/Manila)">{philTime}</div>
          <button type="button" className="action-btn" onClick={loadBooks}>Refresh</button>
          <button type="button" className="action-btn danger" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => setActiveSection(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
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
            {activeSection === 'analytics' && renderAnalytics()}
            {activeSection === 'activity' && renderActivity()}
            {activeSection === 'student-logs' && renderStudentLogs()}
            {activeSection === 'users' && renderUsers()}
            {activeSection === 'settings' && renderSettings()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

