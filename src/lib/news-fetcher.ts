import Parser from 'rss-parser';
import { RSS_FEEDS_BY_LANGUAGE } from './rss-feeds';
import { cleanText } from './utils';
import type { RSSFeedItem, ProcessedArticle } from '@/types/news';

const parser = new Parser({
  requestOptions: {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WhatHappenedTodayBot/1.0; +https://github.com/franklarosa/what-happened-today)',
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    },
  },
});

function localeHeader(languageCode: string = 'en'): string {
  switch (languageCode) {
    case 'it':
      return 'it-IT,it;q=0.9,en;q=0.8';
    case 'fr':
      return 'fr-FR,fr;q=0.9,en;q=0.8';
    default:
      return 'en-US,en;q=0.9';
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function fetchRSSFeed(feedUrl: string, sourceName: string, languageCode: string = 'en'): Promise<RSSFeedItem[]> {
  try {
    // Prefetch with timeout and language-aware headers
    const response = await fetchWithTimeout(feedUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatHappenedTodayBot/1.0; +https://github.com/franklarosa/what-happened-today)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
        'Accept-Language': localeHeader(languageCode),
      },
    }, 10000);

    if (!response.ok) {
      throw new Error(`Status code ${response.status}`);
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);
    
    return (feed.items || []).map((item: Parser.Item) => ({
      title: cleanText(item.title || ''),
      link: item.link || '',
      contentSnippet: cleanText(item.contentSnippet || item.content || ''),
      content: cleanText(item.content || item.contentSnippet || ''),
      pubDate: item.pubDate,
      source: sourceName,
    }));
  } catch (error) {
    console.error(`Error fetching RSS feed from ${sourceName}:`, error);
    return [];
  }
}

export async function fetchAllNews(languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  console.log(`Fetching news from all RSS feeds for language: ${languageCode}`);
  
  const feeds = RSS_FEEDS_BY_LANGUAGE[languageCode] || RSS_FEEDS_BY_LANGUAGE.en;
  // Limit concurrency to avoid hammering networks (max 5 at a time)
  const concurrency = 5;
  const results: PromiseSettledResult<RSSFeedItem[]>[] = [];
  for (let i = 0; i < feeds.length; i += concurrency) {
    const slice = feeds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      slice.map(feed => fetchRSSFeed(feed.url, feed.name, languageCode))
    );
    results.push(...settled);
  }
  
  const allArticles: RSSFeedItem[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
      console.log(`Successfully fetched ${result.value.length} articles from ${feeds[index].name}`);
    } else {
      console.error(`Failed to fetch from ${feeds[index].name}:`, result.reason);
    }
  });
  
  // Filter out articles with insufficient content and convert to ProcessedArticle
  const processedArticles: ProcessedArticle[] = allArticles
    .filter(article => 
      article.title && 
      article.link && 
      article.content &&
      article.title.length > 10 &&
      article.content.length > 50
    )
    .map(article => ({
      title: article.title,
      source: article.source || 'Unknown',
      content: article.content || '',
      link: article.link,
      relevanceScore: 0, // Will be set by AI filtering
      isRelevant: false, // Will be set by AI filtering
    }));
  
  console.log(`Processed ${processedArticles.length} articles total for ${languageCode}`);
  return processedArticles;
}

export async function deduplicateArticles(articles: ProcessedArticle[]): Promise<ProcessedArticle[]> {
  const seen = new Set<string>();
  const unique: ProcessedArticle[] = [];
  
  for (const article of articles) {
    // Create a stronger fingerprint: host+path + normalized title + first 80 of content
    let hostPath = '';
    try {
      const u = new URL(article.link);
      hostPath = `${u.host}${u.pathname}`.toLowerCase();
    } catch {
      hostPath = article.link.toLowerCase();
    }
    const titleKey = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 80);
    const contentKey = article.content.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 80);
    const fingerprint = `${hostPath}|${titleKey}|${contentKey}`;
    
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(article);
    }
  }
  
  console.log(`Removed ${articles.length - unique.length} duplicate articles`);
  return unique;
}
