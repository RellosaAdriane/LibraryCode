import { parseSessionAgent } from './sessionUtils';

describe('sessionUtils', () => {
  test('parseSessionAgent detects Chrome on Windows desktop', () => {
    const parsed = parseSessionAgent('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Windows');
    expect(parsed.deviceType).toBe('Desktop');
    expect(parsed.deviceIcon).toBe('laptop');
  });

  test('parseSessionAgent detects mobile Android', () => {
    const parsed = parseSessionAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Android');
    expect(parsed.deviceType).toBe('Mobile');
    expect(parsed.deviceIcon).toBe('mobile');
  });
});
