import fs from 'fs';
import path from 'path';
import type { DailyNews } from '@/types/news';

const LOCALE_MAP: Record<string, string> = {
  it: 'it-IT',
  fr: 'fr-FR',
  en: 'en-US',
};

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export function safeParseJSON<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenceMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
    let candidate = fenceMatch?.[1] ?? '';

    if (!candidate) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        candidate = text.slice(start, end + 1);
      }
    }

    if (candidate) {
      try { return JSON.parse(candidate) as T; } catch { /* ignore */ }
    }
    return fallback;
  }
}

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

export function getDataFilePath(date: string, languageCode: string = 'en'): string {
  return path.join(process.cwd(), 'data', languageCode, `${date}.json`);
}

export async function saveDailyNews(dailyNews: DailyNews, languageCode: string = 'en'): Promise<void> {
  const filePath = getDataFilePath(dailyNews.date, languageCode);
  const dataDir = path.dirname(filePath);
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  await fs.promises.writeFile(filePath, JSON.stringify(dailyNews, null, 2));
}

export async function loadDailyNews(date: string, languageCode: string = 'en'): Promise<DailyNews | null> {
  const filePath = getDataFilePath(date, languageCode);
  
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as DailyNews;
  } catch {
    return null;
  }
}

export function cleanText(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
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
