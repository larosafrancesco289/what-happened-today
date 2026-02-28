import fs from 'fs';
import path from 'path';
import type { DailyNews } from '@/types/news';

export { getDateString, formatDate, getPreviousDate, getNextDate, getLastWeekRange } from './date-utils';

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
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

export function getDataFilePath(date: string, languageCode: string = 'en'): string {
  return path.join(process.cwd(), 'data', languageCode, `${date}.json`);
}

export async function saveDailyNews(dailyNews: DailyNews, languageCode: string = 'en'): Promise<void> {
  const filePath = getDataFilePath(dailyNews.date, languageCode);
  const dataDir = path.dirname(filePath);
  fs.mkdirSync(dataDir, { recursive: true });
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

/**
 * Normalize a URL to host+path for deduplication.
 * Falls back to lowercased raw link on invalid URLs.
 */
function normalizeLink(link: string): string {
  try {
    const u = new URL(link);
    return `${u.host}${u.pathname}`.toLowerCase();
  } catch {
    return link.toLowerCase();
  }
}

function normalizeTitle(title: string, maxLen: number = 80): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, maxLen);
}

/**
 * Create a dedup fingerprint for an article.
 * When `includeContent` is true the fingerprint is stricter (used for raw-article dedup).
 */
export function articleFingerprint(
  article: { link: string; title: string; content?: string },
  includeContent: boolean = false,
): string {
  const hostPath = normalizeLink(article.link);
  const titleKey = normalizeTitle(article.title);
  if (includeContent && article.content) {
    const contentKey = article.content.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 80);
    return `${hostPath}|${titleKey}|${contentKey}`;
  }
  return `${hostPath}|${titleKey}`;
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
