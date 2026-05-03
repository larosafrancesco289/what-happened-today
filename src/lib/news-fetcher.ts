import Parser from 'rss-parser';
import { DEFAULT_LANGUAGE_CODE, RSS_FEEDS_BY_LANGUAGE, type LanguageCode } from './languages';
import { cleanText, articleFingerprint } from './utils';
import type { RSSFeedItem, ProcessedArticle } from '@/types/news';

export const DEFAULT_MAX_ARTICLE_AGE_HOURS = 48;
const MAX_FUTURE_SKEW_HOURS = 6;

const parser = new Parser({
  requestOptions: {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WhatHappenedTodayBot/1.0; +https://github.com/franklarosa/what-happened-today)',
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
    },
  },
});

interface ParsedRSSItem extends Parser.Item {
  isoDate?: string;
  'dc:date'?: string;
}

export function getConfiguredMaxArticleAgeHours(): number {
  const raw = process.env.NEWS_MAX_ARTICLE_AGE_HOURS;
  if (!raw) return DEFAULT_MAX_ARTICLE_AGE_HOURS;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ARTICLE_AGE_HOURS;
}

function rawPublishedDate(item: ParsedRSSItem): string | undefined {
  return item.isoDate || item.pubDate || item['dc:date'];
}

export function normalizeArticleDate(dateText: string | undefined): string | null {
  if (!dateText) return null;

  const timestamp = Date.parse(dateText);
  if (!Number.isFinite(timestamp)) return null;

  return new Date(timestamp).toISOString();
}

export function getArticleAgeHours(publishedAt: string, referenceDate: Date = new Date()): number | null {
  const timestamp = Date.parse(publishedAt);
  if (!Number.isFinite(timestamp)) return null;

  return (referenceDate.getTime() - timestamp) / 36e5;
}

export function isFreshPublishedAt(
  publishedAt: string,
  referenceDate: Date = new Date(),
  maxAgeHours: number = DEFAULT_MAX_ARTICLE_AGE_HOURS,
): boolean {
  const ageHours = getArticleAgeHours(publishedAt, referenceDate);
  if (ageHours === null) return false;

  return ageHours <= maxAgeHours && ageHours >= -MAX_FUTURE_SKEW_HOURS;
}

function localeHeader(languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE): string {
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

export async function fetchRSSFeed(feedUrl: string, sourceName: string, languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE): Promise<RSSFeedItem[]> {
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
    
    return (feed.items || []).map((item: Parser.Item): RSSFeedItem => {
      const parsedItem = item as ParsedRSSItem;
      const publishedAt = normalizeArticleDate(rawPublishedDate(parsedItem));

      return {
        title: cleanText(parsedItem.title || ''),
        link: parsedItem.link || '',
        contentSnippet: cleanText(parsedItem.contentSnippet || parsedItem.content || ''),
        content: cleanText(parsedItem.content || parsedItem.contentSnippet || ''),
        pubDate: rawPublishedDate(parsedItem),
        publishedAt: publishedAt ?? undefined,
        source: sourceName,
      };
    }).filter(item => Boolean(item.title || item.link || item.content));
  } catch (error) {
    console.error(`Error fetching RSS feed from ${sourceName}:`, error);
    return [];
  }
}

export async function fetchAllNews(languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE): Promise<ProcessedArticle[]> {
  console.log(`Fetching news from all RSS feeds for language: ${languageCode}`);
  
  const feeds = RSS_FEEDS_BY_LANGUAGE[languageCode];
  const activeFeeds = feeds.filter(feed => !feed.disabledReason);
  const disabledFeeds = feeds.filter(feed => feed.disabledReason);
  for (const feed of disabledFeeds) {
    console.warn(`Skipping disabled feed ${feed.name}: ${feed.disabledReason}`);
  }

  // Limit concurrency to avoid hammering networks (max 5 at a time)
  const concurrency = 5;
  const results: PromiseSettledResult<RSSFeedItem[]>[] = [];
  for (let i = 0; i < activeFeeds.length; i += concurrency) {
    const slice = activeFeeds.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      slice.map(feed => fetchRSSFeed(feed.url, feed.name, languageCode))
    );
    results.push(...settled);
  }
  
  const allArticles: RSSFeedItem[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
      console.log(`Successfully fetched ${result.value.length} articles from ${activeFeeds[index].name}`);
    } else {
      console.error(`Failed to fetch from ${activeFeeds[index].name}:`, result.reason);
    }
  });

  const maxArticleAgeHours = getConfiguredMaxArticleAgeHours();
  const now = new Date();
  let articlesWithoutDates = 0;
  let staleArticles = 0;
  const freshArticles = allArticles.filter(article => {
    if (!article.publishedAt) {
      articlesWithoutDates++;
      return false;
    }

    if (!isFreshPublishedAt(article.publishedAt, now, maxArticleAgeHours)) {
      staleArticles++;
      return false;
    }

    return true;
  });

  if (articlesWithoutDates > 0 || staleArticles > 0) {
    console.warn(
      `Freshness filter dropped ${articlesWithoutDates} undated and ${staleArticles} stale/future articles (max age ${maxArticleAgeHours}h)`
    );
  }

  const processedArticles: ProcessedArticle[] = freshArticles
    .filter(article =>
      article.title &&
      article.link &&
      article.content &&
      article.publishedAt &&
      article.title.length > 10 &&
      article.content.length > 50
    )
    .map(article => ({
      title: article.title,
      source: article.source || 'Unknown',
      content: article.content || '',
      link: article.link,
      publishedAt: article.publishedAt!,
      relevanceScore: 0,
      isRelevant: false,
    }));
  
  console.log(`Processed ${processedArticles.length} articles total for ${languageCode}`);
  return processedArticles;
}

export async function deduplicateArticles(articles: ProcessedArticle[]): Promise<ProcessedArticle[]> {
  const seen = new Set<string>();
  const unique: ProcessedArticle[] = [];
  
  for (const article of articles) {
    const fingerprint = articleFingerprint(article, true);
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(article);
    }
  }
  
  console.log(`Removed ${articles.length - unique.length} duplicate articles`);

  // Group articles about the same story from different sources using a loose
  // fingerprint (first 50 alphanumeric chars of title)
  const looseGroups = new Map<string, ProcessedArticle[]>();
  for (const article of unique) {
    const looseKey = article.title
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .toLowerCase()
      .substring(0, 50);
    const group = looseGroups.get(looseKey) || [];
    group.push(article);
    looseGroups.set(looseKey, group);
  }

  const grouped: ProcessedArticle[] = [];
  for (const group of looseGroups.values()) {
    const representative = group.reduce((best, curr) =>
      curr.content.length > best.content.length ? curr : best
    );
    const allSources = [...new Set(group.map(a => a.source))];
    // Preserve full articles from other sources for framing comparison (cap at 4)
    const coveringArticles = allSources.length > 1
      ? group
          .filter(a => a !== representative)
          .slice(0, 4)
          .map(a => ({
            source: a.source,
            title: a.title,
            content: a.content,
            link: a.link,
            publishedAt: a.publishedAt,
          }))
      : undefined;
    grouped.push({
      ...representative,
      coveringSources: allSources.length > 1 ? allSources : undefined,
      coveringArticles,
    });
  }

  console.log(`Cross-source grouping: ${unique.length} → ${grouped.length} distinct stories`);
  return grouped;
}
