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
