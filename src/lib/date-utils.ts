const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  fr: 'fr-FR',
  en: 'en-US',
};

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function formatDate(dateString: string, languageCode: string = 'en'): string {
  const date = new Date(dateString);
  const locale = LOCALE_MAP[languageCode] ?? LOCALE_MAP.en;
  const formatted = date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Capitalize the first letter of each word that contains letters (day and month names)
  return formatted.replace(/\b[a-zA-ZÀ-ÿ]+/g, word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

export function getPreviousDate(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() - 1);
  return getDateString(date);
}

export function getNextDate(dateString: string): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + 1);
  return getDateString(date);
}

/** Get the Monday–Sunday range for the most recently completed week. */
export function getLastWeekRange(referenceDate: Date = new Date()): { startDate: string; endDate: string; weekId: string } {
  const d = new Date(referenceDate);
  // Roll back to last Sunday (end of previous week)
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  d.setDate(d.getDate() - daysToLastSunday);
  const endDate = d.toISOString().split('T')[0];

  // Monday of that week = Sunday - 6
  const monday = new Date(d);
  monday.setDate(monday.getDate() - 6);
  const startDate = monday.toISOString().split('T')[0];

  // ISO week number
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const daysSinceJan4 = Math.floor((monday.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
  const weekId = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  return { startDate, endDate, weekId };
}
