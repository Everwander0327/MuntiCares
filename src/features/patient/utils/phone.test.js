import { describe, it, expect } from 'vitest';
import { isValidPhPhone, normalizePhPhone } from './phone';

describe('normalizePhPhone', () => {
  it('keeps local mobile numbers and strips separators', () => {
    expect(normalizePhPhone('0917 123 4567')).toBe('09171234567');
    expect(normalizePhPhone('0917-123-4567')).toBe('09171234567');
    expect(normalizePhPhone('(0917) 123 4567')).toBe('09171234567');
  });

  it('converts international formats to local', () => {
    expect(normalizePhPhone('+63 917 123 4567')).toBe('09171234567');
    expect(normalizePhPhone('639171234567')).toBe('09171234567');
    expect(normalizePhPhone('9171234567')).toBe('09171234567');
  });

  it('leaves landlines as-is', () => {
    expect(normalizePhPhone('(02) 8888 1234')).toBe('0288881234');
    expect(normalizePhPhone('02 8888 1234')).toBe('0288881234');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhPhone('')).toBe('');
    expect(normalizePhPhone(undefined)).toBe('');
  });
});

describe('isValidPhPhone', () => {
  it('accepts valid mobile and landline formats', () => {
    expect(isValidPhPhone('09171234567')).toBe(true);
    expect(isValidPhPhone('+63 917 123 4567')).toBe(true);
    expect(isValidPhPhone('0288881234')).toBe(true);
    expect(isValidPhPhone('02 8888 1234')).toBe(true);
  });

  it('rejects incomplete or malformed numbers', () => {
    expect(isValidPhPhone('')).toBe(false);
    expect(isValidPhPhone('1234567')).toBe(false);
    expect(isValidPhPhone('0917 123')).toBe(false);
    expect(isValidPhPhone('091712345678')).toBe(false);
    expect(isValidPhPhone('0917 123 456a')).toBe(false);
  });
});
