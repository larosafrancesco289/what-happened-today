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

export async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<RSSFeedItem[]> {
  try {
    // Prefetch with Node's fetch to better handle status codes and content-type
    const response = await fetch(feedUrl, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatHappenedTodayBot/1.0; +https://github.com/franklarosa/what-happened-today)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

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
  
  const fetchPromises = feeds.map(feed => 
    fetchRSSFeed(feed.url, feed.name)
  );
  
  const results = await Promise.allSettled(fetchPromises);
  
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
    // Create a simple fingerprint for deduplication
    const fingerprint = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(article);
    }
  }
  
  console.log(`Removed ${articles.length - unique.length} duplicate articles`);
  return unique;
} 