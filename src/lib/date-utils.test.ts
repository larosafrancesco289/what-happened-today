import { describe, expect, it } from 'bun:test';
import {
  formatDate,
  getCurrentEditionDateString,
  getDateString,
  getLastWeekRange,
  getNextDate,
  getPreviousDate,
  getWeekId,
  isValidDateString,
  isValidWeekId,
} from './date-utils';

describe('date-utils', () => {
  it('uses local calendar values when building the date key', () => {
    const localEvening = new Date(2026, 2, 4, 20, 30);
    expect(getDateString(localEvening)).toBe('2026-03-04');
  });

  it('uses the latest published edition date before and after the UTC cutoff', () => {
    expect(getCurrentEditionDateString(new Date('2026-03-06T05:59:59Z'))).toBe('2026-03-05');
    expect(getCurrentEditionDateString(new Date('2026-03-06T06:00:00Z'))).toBe('2026-03-06');
  });

  it('formats ISO dates without shifting them backward in western timezones', () => {
    expect(formatDate('2026-03-05', 'en')).toBe('Thursday, March 5, 2026');
  });

  it('handles leap years and month boundaries when moving between days', () => {
    expect(getNextDate('2024-02-28')).toBe('2024-02-29');
    expect(getNextDate('2024-02-29')).toBe('2024-03-01');
    expect(getPreviousDate('2026-03-01')).toBe('2026-02-28');
  });

  it('validates real calendar dates and ISO week identifiers', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidWeekId('2026-W09')).toBe(true);
    expect(isValidWeekId('2026-W54')).toBe(false);
  });

  it('returns the last fully completed ISO week range', () => {
    expect(getLastWeekRange(new Date(2026, 2, 5, 12))).toEqual({
      startDate: '2026-02-23',
      endDate: '2026-03-01',
      weekId: '2026-W09',
    });
    expect(getWeekId('2026-02-23')).toBe('2026-W09');
  });
});
