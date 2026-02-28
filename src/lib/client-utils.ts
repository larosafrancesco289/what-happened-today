import type { DailyNews, WeeklyDigest } from '@/types/news';
import { getLastWeekRange } from './date-utils';

export { getDateString, formatDate, getPreviousDate, getNextDate, getLastWeekRange } from './date-utils';

async function fetchJSON<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export function fetchDailySummary(date: string, languageCode: string = 'en'): Promise<DailyNews | null> {
  return fetchJSON(`/api/news?date=${date}&language=${languageCode}`);
}

export function fetchWeeklyDigest(weekId: string, languageCode: string = 'en'): Promise<WeeklyDigest | null> {
  return fetchJSON(`/api/weekly?weekId=${weekId}&language=${languageCode}`);
}

/** Get the ISO week ID (YYYY-WXX) for the most recently completed week. */
export function getLastWeekId(): string {
  return getLastWeekRange().weekId;
}
