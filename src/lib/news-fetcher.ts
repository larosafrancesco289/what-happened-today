import Parser from 'rss-parser';
import { RSS_FEEDS } from './rss-feeds';
import { cleanText } from './utils';
import type { RSSFeedItem, ProcessedArticle } from '@/types/news';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
  },
});

export async function fetchRSSFeed(feedUrl: string, sourceName: string): Promise<RSSFeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    
    return (feed.items || []).map((item: any) => ({
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

export async function fetchAllNews(): Promise<ProcessedArticle[]> {
  console.log('Fetching news from all RSS feeds...');
  
  const fetchPromises = RSS_FEEDS.map(feed => 
    fetchRSSFeed(feed.url, feed.name)
  );
  
  const results = await Promise.allSettled(fetchPromises);
  
  const allArticles: RSSFeedItem[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
      console.log(`Successfully fetched ${result.value.length} articles from ${RSS_FEEDS[index].name}`);
    } else {
      console.error(`Failed to fetch from ${RSS_FEEDS[index].name}:`, result.reason);
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
  
  console.log(`Processed ${processedArticles.length} articles total`);
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