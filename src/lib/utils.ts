import { readFile } from 'fs/promises';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import type { DailyNews } from '@/types/news';

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function getDataFilePath(date: string): string {
  return path.join(process.cwd(), 'data', `${date}.json`);
}

export async function saveDailyNews(dailyNews: DailyNews): Promise<void> {
  const filePath = getDataFilePath(dailyNews.date);
  const dataDir = path.dirname(filePath);
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  await fs.promises.writeFile(filePath, JSON.stringify(dailyNews, null, 2));
}

export async function loadDailyNews(date: string): Promise<DailyNews | null> {
  const filePath = getDataFilePath(date);
  
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

export async function getDailySummary(date: string): Promise<DailyNews | null> {
  try {
    const filePath = join(process.cwd(), 'data', `${date}.json`);
    const fileContent = await readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Failed to load data for ${date}:`, error);
    return null;
  }
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