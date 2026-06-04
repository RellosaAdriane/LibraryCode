import {
  getBookAvailable,
  getBookQuantity,
  getStockBadgeClass,
  isLowStockBook
} from './bookHelpers';

describe('bookHelpers', () => {
  test('reads quantity from modern and legacy fields', () => {
    expect(getBookQuantity({ quantity: 4 })).toBe(4);
    expect(getBookQuantity({ copies_total: 6 })).toBe(6);
    expect(getBookQuantity({})).toBe(0);
  });

  test('caps available copies at total quantity', () => {
    expect(getBookAvailable({ quantity: 3, available: 10 })).toBe(3);
    expect(getBookAvailable({ copies_total: 2, copies_available: 1 })).toBe(1);
  });

  test('flags low stock when available is positive but limited', () => {
    expect(isLowStockBook({ quantity: 5, available: 2 })).toBe(true);
    expect(isLowStockBook({ quantity: 5, available: 0 })).toBe(false);
    expect(isLowStockBook({ quantity: 5, available: 5 })).toBe(false);
  });

  test('maps stock badge classes by availability', () => {
    expect(getStockBadgeClass({ quantity: 1, available: 0 })).toBe('stock-badge danger');
    expect(getStockBadgeClass({ quantity: 5, available: 3 })).toBe('stock-badge warning');
    expect(getStockBadgeClass({ quantity: 10, available: 9 })).toBe('stock-badge normal');
  });
});
