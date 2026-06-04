/** Philippines (Asia/Manila) timezone for all library UI dates. */
export const LIBRARY_TIMEZONE = 'Asia/Manila';

const dateInputFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIBRARY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const displayFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: LIBRARY_TIMEZONE
});

/** YYYY-MM-DD in Philippines time (for inputs and API-style dates). */
export const formatLibraryDate = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return dateInputFormatter.format(value);
};

export const formatLibraryDisplayDate = (date = new Date(), options = {}) => {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: LIBRARY_TIMEZONE,
    ...options
  }).format(value);
};

export const libraryTodayISO = () => formatLibraryDate(new Date());

export const libraryDateYearsAgo = (years) => {
  const [year, month, day] = libraryTodayISO().split('-').map(Number);
  return `${year - years}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

export const libraryNowIso = () => {
  const parts = displayFormatter.formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
};

const clockFullFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LIBRARY_TIMEZONE,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
});

const clockCompactFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LIBRARY_TIMEZONE,
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

/** Format a UTC instant as Asia/Manila clock text. */
export const formatLibraryClockDisplay = (instantMs, compact = false) => {
  const value = Number(instantMs);
  if (!Number.isFinite(value)) return '—';
  const formatter = compact ? clockCompactFormatter : clockFullFormatter;
  return formatter.format(new Date(value));
};

export const formatLibraryDateTime = (instantMs) =>
  formatLibraryDisplayDate(new Date(instantMs), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

export const parseLibraryTimestamp = (dateValue) => {
  if (!dateValue) return NaN;
  const raw = String(dateValue).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return Date.parse(`${raw}T12:00:00+08:00`);
  }
  return Date.parse(raw);
};

export const formatLibraryRelativeTime = (dateValue, nowMs = Date.now()) => {
  if (!dateValue) return 'Recently';
  const parsed = parseLibraryTimestamp(dateValue);
  if (Number.isNaN(parsed)) return String(dateValue).slice(0, 10);
  const diffMs = nowMs - parsed;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatLibraryDisplayDate(new Date(parsed), {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatLibraryTableDate = (value) => {
  const parsed = parseLibraryTimestamp(value);
  if (Number.isNaN(parsed)) return '-';
  return formatLibraryDisplayDate(new Date(parsed), {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatLibraryTableDateTime = (value) => {
  const parsed = parseLibraryTimestamp(value);
  if (Number.isNaN(parsed)) return '-';
  return formatLibraryDateTime(parsed);
};

export const formatLibraryNowStamp = () => formatLibraryDateTime(Date.now());
