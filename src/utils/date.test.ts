import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, getDateRange, isToday, getToday } from './date';

describe('Date utilities', () => {
  it('should parse date string correctly', () => {
    const date = parseDate('2025-01-15');
    expect(date.getUTCFullYear()).toBe(2025);
    expect(date.getUTCMonth()).toBe(0);
    expect(date.getUTCDate()).toBe(15);
  });

  it('should format date correctly', () => {
    const date = new Date('2025-01-15T00:00:00.000Z');
    expect(formatDate(date)).toBe('2025-01-15');
  });

  it('should generate date range correctly', () => {
    const range = getDateRange('2025-01-01', '2025-01-03');
    expect(range).toEqual(['2025-01-01', '2025-01-02', '2025-01-03']);
  });

  it('should handle single day range', () => {
    const range = getDateRange('2025-01-01', '2025-01-01');
    expect(range).toEqual(['2025-01-01']);
  });

  it('should throw error for invalid date range', () => {
    expect(() => getDateRange('2025-01-03', '2025-01-01')).toThrow();
  });
});

