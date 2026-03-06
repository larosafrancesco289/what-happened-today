import { DEFAULT_LANGUAGE_CODE, type LanguageCode } from './languages';

const LOCALE_MAP: Record<LanguageCode, string> = {
  it: 'it-IT',
  fr: 'fr-FR',
  en: 'en-US',
};

const DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_REGEX = /^(\d{4})-W(\d{2})$/;
const DAILY_EDITION_PUBLISH_HOUR_UTC = 6;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateParts(parts: DateParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function buildUtcDate(parts: DateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function getDatePartsFromLocalDate(date: Date): DateParts {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function getDatePartsFromUtcDate(date: Date): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getIsoWeekInfo(date: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return {
    year: target.getUTCFullYear(),
    week,
  };
}

export function parseDateString(dateString: string): DateParts | null {
  const match = DATE_REGEX.exec(dateString);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isValidDateString(dateString: string): boolean {
  return parseDateString(dateString) !== null;
}

export function parseWeekId(weekId: string): { year: number; week: number } | null {
  const match = WEEK_REGEX.exec(weekId);
  if (!match) return null;

  const [, yearRaw, weekRaw] = match;
  const year = Number(yearRaw);
  const week = Number(weekRaw);

  if (!Number.isInteger(year) || !Number.isInteger(week) || week < 1 || week > 53) {
    return null;
  }

  const lastWeekOfYear = getIsoWeekInfo(new Date(Date.UTC(year, 11, 28))).week;
  if (week > lastWeekOfYear) return null;

  return { year, week };
}

export function isValidWeekId(weekId: string): boolean {
  return parseWeekId(weekId) !== null;
}

function addDays(dateString: string, days: number): string {
  const parts = parseDateString(dateString);
  if (!parts) return dateString;

  const date = buildUtcDate(parts);
  date.setUTCDate(date.getUTCDate() + days);

  return formatDateParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function getDateString(date: Date = new Date()): string {
  return formatDateParts(getDatePartsFromLocalDate(date));
}

/**
 * Return the latest daily edition date based on the publish cadence.
 * Daily files are generated at 06:00 UTC, so before that cutoff we keep
 * pointing the UI at the previous UTC day.
 */
export function getCurrentEditionDateString(referenceDate: Date = new Date()): string {
  const effectiveDate = new Date(referenceDate);

  if (referenceDate.getUTCHours() < DAILY_EDITION_PUBLISH_HOUR_UTC) {
    effectiveDate.setUTCDate(effectiveDate.getUTCDate() - 1);
  }

  return formatDateParts(getDatePartsFromUtcDate(effectiveDate));
}

export function formatDate(dateString: string, languageCode: string = DEFAULT_LANGUAGE_CODE): string {
  const parts = parseDateString(dateString);
  if (!parts) return dateString;

  const locale = LOCALE_MAP[(languageCode as LanguageCode)] ?? LOCALE_MAP[DEFAULT_LANGUAGE_CODE];
  const formatted = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(buildUtcDate(parts));

  return formatted.replace(/\b[\p{L}]+/gu, word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

export function getPreviousDate(dateString: string): string {
  return addDays(dateString, -1);
}

export function getNextDate(dateString: string): string {
  return addDays(dateString, 1);
}

export function getWeekId(dateString: string): string | null {
  const parts = parseDateString(dateString);
  if (!parts) return null;

  const { year, week } = getIsoWeekInfo(buildUtcDate(parts));
  return `${year}-W${pad(week)}`;
}

/** Get the Monday-Sunday range for the most recently completed week. */
export function getLastWeekRange(referenceDate: Date = new Date()): { startDate: string; endDate: string; weekId: string } {
  const referenceDateString = getDateString(referenceDate);
  const weekday = referenceDate.getDay();
  const daysToLastSunday = weekday === 0 ? 7 : weekday;
  const endDate = addDays(referenceDateString, -daysToLastSunday);
  const startDate = addDays(endDate, -6);
  const weekId = getWeekId(startDate) ?? `${referenceDate.getFullYear()}-W01`;

  return { startDate, endDate, weekId };
}
