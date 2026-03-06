import type { DailyNews, WeeklyDigest } from '@/types/news';
import { getLastWeekRange } from './date-utils';
import { DEFAULT_LANGUAGE_CODE } from './languages';

export { getDateString, formatDate, getPreviousDate, getNextDate, getLastWeekRange } from './date-utils';
export { getCurrentEditionDateString } from './date-utils';

const CLIENT_FETCH_TIMEOUT_MS = 15000;

async function fetchJSON<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export function fetchDailySummary(date: string, languageCode: string = DEFAULT_LANGUAGE_CODE): Promise<DailyNews | null> {
  const searchParams = new URLSearchParams({
    date,
    language: languageCode,
  });

  return fetchJSON(`/api/news?${searchParams.toString()}`);
}

export function fetchWeeklyDigest(weekId: string, languageCode: string = DEFAULT_LANGUAGE_CODE): Promise<WeeklyDigest | null> {
  const searchParams = new URLSearchParams({
    weekId,
    language: languageCode,
  });

  return fetchJSON(`/api/weekly?${searchParams.toString()}`);
}

/** Get the ISO week ID (YYYY-WXX) for the most recently completed week. */
export function getLastWeekId(): string {
  return getLastWeekRange().weekId;
}
