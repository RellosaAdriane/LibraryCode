import { getStoredUser } from './auth';

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const DEFAULT_API_ORIGIN = isLocalHost
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : window.location.origin;
const ENV_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const envPointsToLocalhost = /https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(ENV_API_BASE_URL);
// If deployed on a real domain but build env still points to localhost, force same-origin.
const API_BASE_URL = (!isLocalHost && envPointsToLocalhost)
  ? window.location.origin
  : (ENV_API_BASE_URL || DEFAULT_API_ORIGIN);
const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '';
const NORMALIZED_API_BASE_URL = isLocalHost
  ? API_BASE_URL.replace(/\/server\/?$/, '')
  : API_BASE_URL;
const NORMALIZED_API_BASE_PATH = isLocalHost
  ? API_BASE_PATH.replace(/^\/server\/?$/, '')
  : API_BASE_PATH;

const API_BASE_ROOT = `${NORMALIZED_API_BASE_URL}${NORMALIZED_API_BASE_PATH || ''}`.replace(/\/$/, '');
const API_BASE_CANDIDATES = [API_BASE_ROOT || window.location.origin];
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000);

const getAuthHeaders = (headers = {}) => {
  const user = getStoredUser();
  const sessionId = user?.session_id ? String(user.session_id) : '';
  return {
    ...headers,
    ...(sessionId ? { 'X-Session-Id': sessionId, Authorization: `Bearer ${sessionId}` } : {})
  };
};

const parseResponse = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    const fallbackMessage = text ? text.slice(0, 300) : 'Invalid server response';
    return { success: false, message: fallbackMessage };
  }
};

const normalizeBookMediaFields = (book) => {
  if (!book || typeof book !== 'object') return book;

  const normalizeUploadedCoverUrl = (coverUrl) => {
    const value = String(coverUrl || '').trim();
    const match = value.match(/^(.*)\/uploads\/book-covers\/([^/?#]+)(?:[?#].*)?$/);
    if (!match) return value;

    const prefix = match[1];
    const filename = encodeURIComponent(match[2]);
    if (prefix === '') {
      return `${API_BASE_CANDIDATES[0]}/book-cover.php?file=${filename}`;
    }
    return `${prefix}/book-cover.php?file=${filename}`;
  };

  const normalizeUploadedQrUrl = (qrUrl) => {
    const value = String(qrUrl || '').trim();
    const match = value.match(/^(.*)\/uploads\/book-qr\/([^/?#]+)(?:[?#].*)?$/);
    if (!match) return value;

    const prefix = match[1];
    const filename = encodeURIComponent(match[2]);
    if (prefix === '') {
      return `${API_BASE_CANDIDATES[0]}/book-qr.php?file=${filename}`;
    }
    return `${prefix}/book-qr.php?file=${filename}`;
  };

  const normalizedCoverUrl =
    normalizeUploadedCoverUrl(book.cover_image_url
    || book.cover_url
    || book.coverImageUrl
    || book.cover
    || book.image
    || '');
  const normalizedQrUrl =
    normalizeUploadedQrUrl(book.qr_image_url
    || book.qr_url
    || book.qrImageUrl
    || book.qr
    || '');

  return {
    ...book,
    cover_image_url: normalizedCoverUrl,
    qr_image_url: normalizedQrUrl
  };
};

const requestWithFallback = async (
  path,
  options = {},
  fallbackMessage = 'Connection error',
  config = {}
) => {
  const { allowNonJsonSuccess = false } = config;
  let lastFailure = { success: false, message: fallbackMessage };

  for (const baseUrl of API_BASE_CANDIDATES) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers: getAuthHeaders(options.headers || {}),
          signal: controller.signal
        });
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        let parsed;
        try {
          parsed = JSON.parse(text || '');
        } catch (error) {
          parsed = { success: false, message: text ? text.slice(0, 300) : fallbackMessage };
        }

        if (contentType.includes('application/json')) {
          return parsed;
        }

        if (response.ok) {
          if (allowNonJsonSuccess) {
            return parsed && typeof parsed === 'object'
              ? parsed
              : { success: true, message: text || 'Success' };
          }
          lastFailure = { success: false, message: fallbackMessage };
          continue;
        }

        if (parsed && typeof parsed === 'object') {
          lastFailure = parsed;
        }
      } catch (error) {
        lastFailure = {
          success: false,
          message: error?.name === 'AbortError'
            ? 'The server took too long to respond. Please try again.'
            : fallbackMessage
        };
      } finally {
        window.clearTimeout(timeout);
      }
  }

  return lastFailure;
};

export const api = {
  // Login user
  login: async (email, password, options = {}) => {
    try {
      return await requestWithFallback('/login.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, ...options }),
      }, 'Unable to reach authentication service. Please try again.');
    } catch (error) {
      return { success: false, message: 'Unable to reach authentication service. Please try again.' };
    }
  },

  // Register user
  register: async (userData) => {
    try {
      return await requestWithFallback('/register.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      }, 'Connection error. Make sure the backend server is running.');
    } catch (error) {
      return { success: false, message: 'Connection error. Make sure the backend server is running.' };
    }
  },

  requestSignupOtp: async (userData) => {
    return api.register({ ...userData, action: 'send_otp' });
  },

  verifySignupOtp: async (userData, otp) => {
    return api.register({ ...userData, otp, action: 'verify_otp' });
  },

  requestPasswordResetOtp: async (email) => {
    try {
      return await requestWithFallback('/reset-password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'send_otp', email }),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  resetPassword: async (email, otp, newPassword) => {
    try {
      return await requestWithFallback('/reset-password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'verify_otp', email, otp, new_password: newPassword }),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  changePassword: async (email, currentPassword, newPassword) => {
    try {
      return await requestWithFallback('/change-password.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  getSignupSettings: async () => {
    try {
      return await requestWithFallback('/signup-settings.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  updateSignupSettings: async (settings) => {
    try {
      return await requestWithFallback('/signup-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getPenaltySettings: async () => {
    try {
      return await requestWithFallback('/penalty-settings.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  updatePenaltySettings: async (settings) => {
    try {
      return await requestWithFallback('/penalty-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getAnnouncementSettings: async () => {
    try {
      return await requestWithFallback('/announcement-settings.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  updateAnnouncementSettings: async (settings) => {
    try {
      return await requestWithFallback('/announcement-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  borrowBook: async ({ bookId, dueDays } = {}) => {
    try {
      return await requestWithFallback('/borrow.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          book_id: bookId,
          due_days: dueDays
        }),
      }, 'Unable to process borrow request.');
    } catch (error) {
      return { success: false, message: 'Unable to process borrow request.' };
    }
  },
  getSsoSettings: async () => {
    try {
      return await requestWithFallback('/sso-settings.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  updateSsoSettings: async (settings) => {
    try {
      return await requestWithFallback('/sso-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  ssoLogin: async (email) => {
    try {
      return await requestWithFallback('/sso-login.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      }, 'Unable to reach SSO service.');
    } catch (error) {
      return { success: false, message: 'Unable to reach SSO service.' };
    }
  },
  getGoogleConfig: async () => {
    try {
      return await requestWithFallback('/google-config.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  googleAuth: async (credential, action = 'login', extra = {}) => {
    try {
      const payload = { credential, action, ...extra };
      return await requestWithFallback('/google-auth.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 'Unable to reach Google authentication service.');
    } catch (error) {
      return { success: false, message: 'Unable to reach Google authentication service.' };
    }
  },
  getAdmin2faSettings: async () => {
    try {
      return await requestWithFallback('/admin-2fa-settings.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  updateAdmin2faSettings: async (settings) => {
    try {
      return await requestWithFallback('/admin-2fa-settings.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getSessions: async ({ requesterId, requesterEmail, userId, includeRevoked } = {}) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    if (userId) query.set('user_id', String(userId));
    if (typeof includeRevoked === 'boolean') query.set('include_revoked', includeRevoked ? '1' : '0');
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/sessions.php${suffix}`, {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  revokeSession: async ({ sessionId, requesterId, requesterEmail }) => {
    const user = getStoredUser();
    try {
      return await requestWithFallback('/sessions.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'revoke',
          session_id: sessionId,
          requester_session_id: user?.session_id || '',
          requester_id: requesterId,
          requester_email: requesterEmail,
        }),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  validateSession: async ({ sessionId, requesterId, requesterEmail }) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (sessionId) query.set('session_id', sessionId);
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/sessions.php${suffix}`, {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  touchSession: async ({ sessionId }) => {
    const user = getStoredUser();
    try {
      return await requestWithFallback('/sessions.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'touch',
          session_id: sessionId,
          requester_session_id: user?.session_id || '',
        }),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getUsers: async ({ requesterId, requesterEmail } = {}) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/users.php${suffix}`, {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  updateUserRole: async (payload) => {
    const user = getStoredUser();
    try {
      return await requestWithFallback('/users.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          requester_session_id: user?.session_id || '',
        }),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getAdminUserBorrows: async ({ userId, requesterId, requesterEmail } = {}) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    if (userId) query.set('user_id', String(userId));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/api/admin/user-borrows.php${suffix}`, {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getAdminRecentCirculation: async ({ limit = 10, requesterId, requesterEmail } = {}) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    if (limit) query.set('limit', String(limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/api/admin/recent-circulation.php${suffix}`, {}, 'Unable to load recent activity.');
    } catch (error) {
      return { success: false, message: 'Unable to load recent activity.' };
    }
  },
  getAdminBorrowRecords: async ({ type = 'all', limit = 50, requesterId, requesterEmail } = {}) => {
    const user = getStoredUser();
    const query = new URLSearchParams();
    if (user?.session_id) query.set('requester_session_id', String(user.session_id));
    if (requesterId) query.set('requester_id', String(requesterId));
    if (requesterEmail) query.set('requester_email', requesterEmail);
    if (type) query.set('type', String(type));
    if (limit) query.set('limit', String(limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await requestWithFallback(`/api/admin/borrow-records.php${suffix}`, {}, 'Unable to load borrowing records.');
    } catch (error) {
      return { success: false, message: 'Unable to load borrowing records.' };
    }
  },
  // Get all books
  getBooks: async () => {
    try {
      const result = await requestWithFallback('/books.php', {}, 'Connection error');
      if (result?.success && Array.isArray(result.books)) {
        return {
          ...result,
          books: result.books.map(normalizeBookMediaFields)
        };
      }
      return result;
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  // Add book
  addBook: async (bookData) => {
    try {
      const user = getStoredUser();
      const payload = { ...bookData };
      if (user) {
        payload.requester_session_id = user.session_id;
        payload.requester_id = user.id;
        payload.requester_email = user.email;
      }
      return await requestWithFallback('/books.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  // Update book
  updateBook: async (bookData) => {
    try {
      const user = getStoredUser();
      const payload = { ...bookData };
      if (user) {
        payload.requester_session_id = user.session_id;
        payload.requester_id = user.id;
        payload.requester_email = user.email;
      }
      return await requestWithFallback('/books.php', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  uploadBookQr: async (bookId, file) => {
    try {
      const formData = new FormData();
      formData.append('book_id', String(bookId));
      formData.append('action', 'upload');
      formData.append('qr_image', file);
      return await requestWithFallback('/book-qr.php', {
        method: 'POST',
        body: formData,
      }, 'Connection error while uploading QR.', { allowNonJsonSuccess: true });
    } catch (error) {
      return { success: false, message: 'Connection error while uploading QR.' };
    }
  },

  uploadBookCover: async (bookId, file) => {
    try {
      const formData = new FormData();
      formData.append('book_id', String(bookId));
      formData.append('cover_image', file);
      return await requestWithFallback('/book-cover.php', {
        method: 'POST',
        body: formData,
      }, 'Connection error while uploading book cover.', { allowNonJsonSuccess: true });
    } catch (error) {
      return { success: false, message: 'Connection error while uploading book cover.' };
    }
  },

  generateBookQr: async (bookId) => {
    try {
      const formData = new FormData();
      formData.append('book_id', String(bookId));
      formData.append('action', 'generate');
      return await requestWithFallback('/book-qr.php', {
        method: 'POST',
        body: formData,
      }, 'Connection error while generating QR.', { allowNonJsonSuccess: true });
    } catch (error) {
      return { success: false, message: 'Connection error while generating QR.' };
    }
  },

  // Archive book
  archiveBook: async (id) => {
    try {
      const user = getStoredUser();
      const query = new URLSearchParams({ id: String(id) });
      if (user) {
        query.set('requester_session_id', String(user.session_id || ''));
        query.set('requester_id', String(user.id || ''));
        query.set('requester_email', String(user.email || ''));
      }
      return await requestWithFallback(`/books.php?${query.toString()}`, {
        method: 'DELETE',
      }, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  // Get student summary
  getStudentSummary: async () => {
    try {
      return await requestWithFallback('/api/student/summary.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  // Get recent activity (borrow transaction history)
  getRecentActivity: async (email) => {
    try {
      return await requestWithFallback(`/api/student/recent-activity.php?email=${encodeURIComponent(email)}`, {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },

  getMyStudentActivities: async () => {
    try {
      return await requestWithFallback('/api/student/activities.php', {}, 'Unable to load activity');
    } catch (error) {
      return { success: false, message: 'Unable to load activity' };
    }
  },

  getBorrowedBooks: async () => {
    try {
      return await requestWithFallback('/api/student/borrowed.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  getReturnedBooks: async () => {
    try {
      return await requestWithFallback('/api/student/returned.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  },
  returnBook: async ({ transactionId, bookId } = {}) => {
    try {
      return await requestWithFallback('/api/student/return.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_id: transactionId,
          book_id: bookId
        }),
      }, 'Unable to return book.');
    } catch (error) {
      return { success: false, message: 'Unable to return book.' };
    }
  },
  getStudentCollection: async (type = '') => {
    const suffix = type ? `?type=${encodeURIComponent(type)}` : '';
    try {
      return await requestWithFallback(`/api/student/collection.php${suffix}`, {}, 'Unable to load saved books.');
    } catch (error) {
      return { success: false, message: 'Unable to load saved books.' };
    }
  },
  saveStudentCollectionItem: async ({ bookId, type }) => {
    try {
      return await requestWithFallback('/api/student/collection.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId, type }),
      }, 'Unable to save item.');
    } catch (error) {
      return { success: false, message: 'Unable to save item.' };
    }
  },
  removeStudentCollectionItem: async ({ bookId, type }) => {
    try {
      return await requestWithFallback('/api/student/collection.php', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ book_id: bookId, type }),
      }, 'Unable to remove item.');
    } catch (error) {
      return { success: false, message: 'Unable to remove item.' };
    }
  },

  // Student activity (server-backed)
  postStudentActivity: async (payload) => {
    try {
      return await requestWithFallback('/student-activity.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }, 'Unable to save student activity');
    } catch (error) {
      return { success: false, message: 'Unable to save student activity' };
    }
  },

  getStudentActivities: async () => {
    try {
      return await requestWithFallback('/student-activity.php', {}, 'Unable to load student activity');
    } catch (error) {
      return { success: false, message: 'Unable to load student activity' };
    }
  },

  getSecurityLogs: async () => {
    try {
      return await requestWithFallback('/security-logs.php', {}, 'Unable to load security logs.');
    } catch (error) {
      return { success: false, message: 'Unable to load security logs.' };
    }
  },
  getPhilippineTime: async () => {
    try {
      return await requestWithFallback('/phil_time.php', {}, 'Connection error');
    } catch (error) {
      return { success: false, message: 'Connection error' };
    }
  }
};
