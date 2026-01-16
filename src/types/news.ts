// News categories for organizing headlines by topic
export type Category =
  | 'conflict'      // Wars, military actions, terrorism
  | 'politics'      // Elections, policy, diplomacy
  | 'economy'       // Markets, trade, business
  | 'science'       // Research, technology, health
  | 'environment'   // Climate, disasters, conservation
  | 'society';      // Human rights, culture, demographics

// Geographic regions for filtering
export type Region =
  | 'europe'
  | 'americas'
  | 'asia-pacific'
  | 'middle-east'
  | 'africa'
  | 'global';

// Story importance levels
export type Importance = 'breaking' | 'major' | 'notable';

export interface NewsHeadline {
  title: string;
  source: string;
  summary: string;
  link: string;
  category?: Category;
  region?: Region;
  importance?: Importance;
}

export interface DailyNewsMetadata {
  sourcesUsed: number;
  articlesProcessed: number;
  categoryCounts?: Partial<Record<Category, number>>;
  regionCounts?: Partial<Record<Region, number>>;
}

export interface DailyNews {
  date: string;
  summary: string;
  headlines: NewsHeadline[];
  metadata?: DailyNewsMetadata;
  /** If true, news generation failed - display "unavailable" message to user */
  unavailable?: boolean;
  /** Reason for unavailability (for debugging) */
  unavailableReason?: string;
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