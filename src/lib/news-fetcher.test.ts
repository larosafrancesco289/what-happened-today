import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_MAX_ARTICLE_AGE_HOURS,
  getArticleAgeHours,
  isFreshPublishedAt,
  normalizeArticleDate,
} from './news-fetcher';

describe('news freshness helpers', () => {
  const referenceDate = new Date('2026-05-02T12:00:00.000Z');

  it('normalizes valid RSS publication dates to ISO timestamps', () => {
    expect(normalizeArticleDate('Sat, 02 May 2026 10:30:00 GMT')).toBe('2026-05-02T10:30:00.000Z');
  });

  it('rejects invalid or missing publication dates', () => {
    expect(normalizeArticleDate(undefined)).toBeNull();
    expect(normalizeArticleDate('not a date')).toBeNull();
  });

  it('accepts recent articles and rejects stale articles', () => {
    expect(isFreshPublishedAt('2026-05-01T12:30:00.000Z', referenceDate, DEFAULT_MAX_ARTICLE_AGE_HOURS)).toBe(true);
    expect(isFreshPublishedAt('2026-04-29T12:00:00.000Z', referenceDate, DEFAULT_MAX_ARTICLE_AGE_HOURS)).toBe(false);
  });

  it('allows small future clock skew but rejects implausible future dates', () => {
    expect(isFreshPublishedAt('2026-05-02T17:30:00.000Z', referenceDate, DEFAULT_MAX_ARTICLE_AGE_HOURS)).toBe(true);
    expect(isFreshPublishedAt('2026-05-03T12:00:00.000Z', referenceDate, DEFAULT_MAX_ARTICLE_AGE_HOURS)).toBe(false);
  });

  it('computes article age in hours', () => {
    expect(getArticleAgeHours('2026-05-02T09:00:00.000Z', referenceDate)).toBe(3);
  });
});
