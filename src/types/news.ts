export interface NewsHeadline {
  title: string;
  source: string;
  summary: string;
  link: string;
}

export interface DailyNews {
  date: string;
  summary: string;
  headlines: NewsHeadline[];
}

export interface RSSFeedItem {
  title: string;
  link: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
  source?: string;
}

export interface ProcessedArticle {
  title: string;
  source: string;
  content: string;
  link: string;
  relevanceScore: number;
  isRelevant: boolean;
} 