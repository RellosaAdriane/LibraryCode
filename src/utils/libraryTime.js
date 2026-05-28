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
