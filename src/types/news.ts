export type Category =
  | 'conflict'
  | 'politics'
  | 'economy'
  | 'science'
  | 'environment'
  | 'society';

export type Region =
  | 'europe'
  | 'americas'
  | 'asia-pacific'
  | 'middle-east'
  | 'africa'
  | 'global';

export type Importance = 'breaking' | 'major' | 'notable';

export type Tier = 'top' | 'also' | 'developing';

export interface NewsHeadline {
  title: string;
  source: string;
  summary: string;
  link: string;
  category?: Category;
  region?: Region;
  importance?: Importance;
  sources?: string[];
  tier?: Tier;
  /** For developing tier: how many consecutive days this story has run */
  dayNumber?: number;
  /** For developing tier: what changed since the previous day */
  previousContext?: string;
  /** True when only one source covers this story */
  singleSource?: boolean;
}

export interface DailyNewsMetadata {
  sourcesUsed: number;
  articlesProcessed: number;
  articlesAfterDedup?: number;
  articlesAfterDiversity?: number;
  articlesAfterFilter?: number;
  categoryCounts?: Partial<Record<Category, number>>;
  regionCounts?: Partial<Record<Region, number>>;
  tierCounts?: Partial<Record<Tier, number>>;
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
  /** Other sources covering the same story (set during cross-source grouping) */
  coveringSources?: string[];
}

export interface WeeklyDigest {
  weekId: string;
  startDate: string;
  endDate: string;
  summary: string;
  persistentStories: string[];
  topHeadlines: Array<{
    date: string;
    title: string;
    category?: Category;
    region?: Region;
  }>;
  metadata: {
    totalArticlesProcessed: number;
    totalSourcesUsed: number;
    daysWithData: number;
    categoryCounts: Partial<Record<Category, number>>;
    regionCounts: Partial<Record<Region, number>>;
  };
}