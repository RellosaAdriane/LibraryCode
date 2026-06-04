import { LOW_STOCK_THRESHOLD } from '../constants';

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getBookQuantity = (book = {}) => {
  const quantity = toNumber(book.quantity);
  if (quantity !== null) return Math.max(0, quantity);

  const legacyQuantity = toNumber(book.copies_total);
  if (legacyQuantity !== null) return Math.max(0, legacyQuantity);

  return 0;
};

export const getBookAvailable = (book = {}) => {
  const quantity = getBookQuantity(book);
  const available = toNumber(book.available);
  const legacyAvailable = toNumber(book.copies_available);
  const rawAvailable = available ?? legacyAvailable ?? quantity;
  return Math.min(Math.max(0, rawAvailable), quantity);
};

export const isLowStockBook = (book = {}) => {
  const available = getBookAvailable(book);
  return available > 0 && available <= LOW_STOCK_THRESHOLD;
};

export const getStockBadgeClass = (book = {}) => {
  const available = getBookAvailable(book);
  if (available <= 0) return 'stock-badge danger';
  if (available <= 5) return 'stock-badge warning';
  return 'stock-badge normal';
};
