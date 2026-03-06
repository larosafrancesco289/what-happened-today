import type { Category, DailyNews, NewsHeadline, ProcessedArticle, Region, Tier } from '@/types/news';
import { filterAndRankArticles, generateHeadlines, generateDailySummary, categorizeHeadlines } from '@/lib/llm-client';
import { fetchAllNews, deduplicateArticles } from '@/lib/news-fetcher';
import { getDateString, getPreviousDate, loadDailyNews, saveDailyNews, withTimeout } from '@/lib/utils';
import { DEFAULT_LANGUAGE_CODE, type LanguageCode } from '@/lib/languages';

export interface DailyPipelineValidation {
  valid: boolean;
  warnings: string[];
}

export interface DailyPipelineResult {
  success: boolean;
  date: string;
  language: LanguageCode;
  articlesProcessed: number;
  headlinesGenerated: number;
  unavailable?: boolean;
  validation?: DailyPipelineValidation;
  error?: string;
}

function ensureSourceDiversity(articles: ProcessedArticle[]): ProcessedArticle[] {
  const MAX_PER_SOURCE = 5;
  const MIN_SOURCES = 5;
  const bySource = new Map<string, ProcessedArticle[]>();

  for (const article of articles) {
    const source = article.source || 'Unknown';
    const current = bySource.get(source) ?? [];

    if (current.length < MAX_PER_SOURCE) {
      current.push(article);
    }

    bySource.set(source, current);
  }

  const balanced = Array.from(bySource.values()).flat();

  if (bySource.size < MIN_SOURCES) {
    console.warn(`Warning: Only ${bySource.size} sources available (recommend ${MIN_SOURCES}+)`);
  } else {
    console.log(`Source diversity: ${bySource.size} unique sources`);
  }

  return balanced;
}

function countByField<K extends string>(
  headlines: NewsHeadline[],
  field: keyof NewsHeadline,
): Partial<Record<K, number>> {
  const counts: Partial<Record<K, number>> = {};

  for (const headline of headlines) {
    const value = headline[field] as K | undefined;
    if (value) {
      counts[value] = ((counts[value] as number) || 0) + 1;
    }
  }

  return counts;
}

export function validateDailyNews(news: DailyNews): DailyPipelineValidation {
  const warnings: string[] = [];

  if (news.summary.length < 150) {
    warnings.push(`Summary is too short (${news.summary.length} chars, recommend 150+)`);
  }

  if (news.summary.length > 1500) {
    warnings.push(`Summary is too long (${news.summary.length} chars, recommend <1500)`);
  }

  if (news.headlines.length < 4) {
    warnings.push(`Too few headlines (${news.headlines.length}, recommend 4+)`);
  }

  if (news.headlines.length > 20) {
    warnings.push(`Too many headlines (${news.headlines.length}, recommend <20)`);
  }

  const titles = news.headlines.map(headline => headline.title.toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size < titles.length) {
    warnings.push(`Duplicate headlines detected (${titles.length - uniqueTitles.size} duplicates)`);
  }

  const sources = new Set(news.headlines.map(headline => headline.source));
  if (sources.size < 3) {
    warnings.push(`Low source diversity (${sources.size} unique sources, recommend 3+)`);
  }

  if (warnings.length > 0) {
    console.warn('Validation warnings:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  } else {
    console.log('Validation passed: No warnings');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

interface UnavailableParams {
  date: string;
  languageCode: LanguageCode;
  reason: string;
  articlesProcessed: number;
  headlinesGenerated: number;
  metadata: DailyNews['metadata'];
}

async function saveUnavailable({
  date,
  languageCode,
  reason,
  articlesProcessed,
  headlinesGenerated,
  metadata,
}: UnavailableParams): Promise<DailyPipelineResult> {
  console.error(`\n${'='.repeat(60)}`);
  console.error(`WARNING: ${reason}`);
  console.error('Saving "unavailable" state instead.');
  console.error(`${'='.repeat(60)}\n`);

  const unavailableNews: DailyNews = {
    date,
    summary: '',
    headlines: [],
    unavailable: true,
    unavailableReason: reason,
    metadata,
  };

  await withTimeout(saveDailyNews(unavailableNews, languageCode), 10000, 'File saving');
  console.log(`Saved unavailable state for ${languageCode} - frontend will show appropriate message`);

  return {
    success: false,
    date,
    language: languageCode,
    articlesProcessed,
    headlinesGenerated,
    unavailable: true,
  };
}

export async function runDailyPipeline(languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE): Promise<DailyPipelineResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting daily news pipeline for language: ${languageCode.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('Step 1/7: Fetching RSS feeds...');
  const rawArticles = await withTimeout(fetchAllNews(languageCode), 60000, 'RSS fetching');
  if (rawArticles.length === 0) {
    throw new Error('No articles fetched from RSS feeds');
  }
  console.log(`  Fetched ${rawArticles.length} articles\n`);

  console.log('Step 2/7: Deduplicating articles...');
  const uniqueArticles = await deduplicateArticles(rawArticles);
  console.log(`  Unique articles: ${uniqueArticles.length} (removed ${rawArticles.length - uniqueArticles.length} duplicates)\n`);

  console.log('Step 3/7: Ensuring source diversity...');
  const balancedArticles = ensureSourceDiversity(uniqueArticles);
  console.log(`  Balanced articles: ${balancedArticles.length}\n`);

  console.log('Step 4/7: Filtering and ranking articles with AI...');
  const filteredArticles = await withTimeout(
    filterAndRankArticles(balancedArticles, languageCode),
    180000,
    'AI filtering',
  );

  if (filteredArticles.length === 0) {
    throw new Error('No relevant articles after AI filtering');
  }
  console.log(`  Filtered articles: ${filteredArticles.length}\n`);

  const today = getDateString(new Date());
  const yesterday = getPreviousDate(today);
  const yesterdayNews = await loadDailyNews(yesterday, languageCode);
  const yesterdayHeadlines = yesterdayNews?.headlines ?? [];

  if (yesterdayHeadlines.length > 0) {
    console.log(`  Loaded ${yesterdayHeadlines.length} headlines from yesterday (${yesterday}) for continuity\n`);
  } else {
    console.log(`  No yesterday data found (${yesterday}) - running without memory\n`);
  }

  console.log('Step 5/7: Generating headlines with AI...');
  const headlines = await withTimeout(
    generateHeadlines(filteredArticles, languageCode, yesterdayHeadlines),
    180000,
    'Headlines generation',
  );
  console.log(`  Generated ${headlines.length} headlines\n`);

  if (headlines.length === 0) {
    return saveUnavailable({
      date: today,
      languageCode,
      reason: `Headline generation failed: LLM returned 0 headlines from ${filteredArticles.length} filtered articles (${rawArticles.length} total fetched)`,
      articlesProcessed: rawArticles.length,
      headlinesGenerated: 0,
      metadata: {
        sourcesUsed: 0,
        articlesProcessed: rawArticles.length,
        articlesAfterDedup: uniqueArticles.length,
        articlesAfterDiversity: balancedArticles.length,
        articlesAfterFilter: filteredArticles.length,
        categoryCounts: {},
        regionCounts: {},
      },
    });
  }

  console.log('Step 6/7: Categorizing headlines...');
  const categorizedHeadlines = await withTimeout(
    categorizeHeadlines(headlines, languageCode),
    60000,
    'Categorization',
  );
  const categoryCounts = countByField<Category>(categorizedHeadlines, 'category');
  const regionCounts = countByField<Region>(categorizedHeadlines, 'region');
  console.log(`  Categories: ${JSON.stringify(categoryCounts)}`);
  console.log(`  Regions: ${JSON.stringify(regionCounts)}\n`);

  console.log('Step 7/7: Generating daily summary with AI...');
  let summary: string;
  try {
    summary = await withTimeout(
      generateDailySummary(categorizedHeadlines, languageCode, yesterdayHeadlines),
      180000,
      'Summary generation',
    );
    console.log(`  Summary length: ${summary.length} characters`);
    console.log(`  Preview: ${summary.substring(0, 100)}...\n`);
  } catch (summaryError) {
    return saveUnavailable({
      date: today,
      languageCode,
      reason: `Summary generation failed: ${(summaryError as Error).message}`,
      articlesProcessed: rawArticles.length,
      headlinesGenerated: categorizedHeadlines.length,
      metadata: {
        sourcesUsed: new Set(filteredArticles.map(article => article.source)).size,
        articlesProcessed: rawArticles.length,
        articlesAfterDedup: uniqueArticles.length,
        articlesAfterDiversity: balancedArticles.length,
        articlesAfterFilter: filteredArticles.length,
        categoryCounts,
        regionCounts,
      },
    });
  }

  const tierCounts = countByField<Tier>(categorizedHeadlines, 'tier');
  const dailyNews: DailyNews = {
    date: today,
    summary,
    headlines: categorizedHeadlines,
    metadata: {
      sourcesUsed: new Set(filteredArticles.map(article => article.source)).size,
      articlesProcessed: rawArticles.length,
      articlesAfterDedup: uniqueArticles.length,
      articlesAfterDiversity: balancedArticles.length,
      articlesAfterFilter: filteredArticles.length,
      categoryCounts,
      regionCounts,
      tierCounts,
    },
  };

  console.log('Validating output...');
  const validation = validateDailyNews(dailyNews);

  console.log('\nSaving daily news...');
  await withTimeout(saveDailyNews(dailyNews, languageCode), 10000, 'File saving');
  console.log('File saved successfully!');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUCCESS: Generated daily news for ${today} (${languageCode})`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Headlines: ${categorizedHeadlines.length} stories`);
  console.log(`  Sources used: ${dailyNews.metadata?.sourcesUsed}`);
  console.log(`  Articles processed: ${dailyNews.metadata?.articlesProcessed}`);
  console.log(`  Validation: ${validation.valid ? 'PASSED' : 'WARNINGS'}`);
  console.log(`${'='.repeat(60)}\n`);

  return {
    success: true,
    date: today,
    language: languageCode,
    articlesProcessed: rawArticles.length,
    headlinesGenerated: categorizedHeadlines.length,
    validation,
  };
}

export async function runDailyPipelineSafely(languageCode: LanguageCode = DEFAULT_LANGUAGE_CODE): Promise<DailyPipelineResult> {
  try {
    return await runDailyPipeline(languageCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Daily news pipeline failed for ${languageCode}:`, error);

    return {
      success: false,
      date: getDateString(new Date()),
      language: languageCode,
      articlesProcessed: 0,
      headlinesGenerated: 0,
      error: message,
    };
  }
}
