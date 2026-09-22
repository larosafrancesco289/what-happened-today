import Parser from 'rss-parser';
import type { Lang } from '../languages';
import { FEEDS } from './feeds';

export interface Article {
  source: string;
  title: string;
  excerpt: string;
  link: string;
  publishedAt: string;
}

const MAX_AGE_HOURS = 30;
const MAX_EXCERPT_CHARS = 280;
const parser = new Parser();

function clean(text: string | undefined): string {
  return (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function fetchFeed(source: string, url: string): Promise<Article[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatHappenedToday/2.0)' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const feed = await parser.parseString(await response.text());
  return feed.items.flatMap(item => {
    const published = Date.parse(item.isoDate ?? item.pubDate ?? '');
    const title = clean(item.title);
    if (!title || !item.link || Number.isNaN(published)) return [];
    return [{
      source,
      title,
      excerpt: clean(item.contentSnippet ?? item.content).slice(0, MAX_EXCERPT_CHARS),
      link: item.link.trim(),
      publishedAt: new Date(published).toISOString(),
    }];
  });
}

/** Articles published in the last 30 hours across all of the language's feeds. */
export async function fetchArticles(lang: Lang, now: Date): Promise<Article[]> {
  const feeds = FEEDS[lang];
  const results = await Promise.allSettled(feeds.map(([source, url]) => fetchFeed(source, url)));

  const oldest = now.getTime() - MAX_AGE_HOURS * 3_600_000;
  const newest = now.getTime() + 3_600_000;
  const articles: Article[] = [];

  results.forEach((result, i) => {
    const source = feeds[i][0];
    if (result.status === 'rejected') {
      console.warn(`  ✗ ${source}: ${result.reason}`);
      return;
    }
    const fresh = result.value.filter(a => {
      const t = Date.parse(a.publishedAt);
      return t >= oldest && t <= newest;
    });
    console.log(`  ✓ ${source}: ${fresh.length} fresh of ${result.value.length}`);
    articles.push(...fresh);
  });

  return articles;
}
