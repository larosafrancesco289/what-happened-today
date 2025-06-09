import type { DailyNews } from '@/types/news';

export async function fetchDailySummary(date: string, languageCode: string = 'en'): Promise<DailyNews | null> {
  try {
    const response = await fetch(`/api/news?date=${date}&language=${languageCode}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No data found
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    throw error;
  }
}

export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export function formatDate(dateString: string, languageCode: string = 'en'): string {
  const date = new Date(dateString);
  const locale = languageCode === 'it' ? 'it-IT' : 'en-US';
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