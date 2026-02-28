import type { DailyNews, WeeklyDigest } from '@/types/news';

export { getDateString, formatDate, getPreviousDate, getNextDate } from './date-utils';

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
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  d.setDate(d.getDate() - daysToLastSunday);
  const monday = new Date(d);
  monday.setDate(monday.getDate() - 6);
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const daysSinceJan4 = Math.floor((monday.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
  return `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
