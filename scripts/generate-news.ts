#!/usr/bin/env bun

// Bun automatically loads .env and .env.local files
// No explicit dotenv configuration needed

// Standalone script to generate daily news for GitHub Actions
// IMPORTANT: We dynamically import dependencies AFTER loading env so the correct
// OPENROUTER_API_KEY from .env.local is used when initializing the LLM client.

import type { DailyNews, NewsHeadline, Category, Region, ProcessedArticle } from '../src/types/news';

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

// Ensure source diversity by capping articles per source
function ensureSourceDiversity(articles: ProcessedArticle[]): ProcessedArticle[] {
  const MAX_PER_SOURCE = 5;
  const MIN_SOURCES = 5;

  const bySource = new Map<string, ProcessedArticle[]>();
  for (const article of articles) {
    const source = article.source || 'Unknown';
    const arr = bySource.get(source) || [];
    if (arr.length < MAX_PER_SOURCE) {
      arr.push(article);
    }
    bySource.set(source, arr);
  }

  const balanced: ProcessedArticle[] = [];
  for (const sourceArticles of bySource.values()) {
    balanced.push(...sourceArticles);
  }

  // Log warning if too few sources
  if (bySource.size < MIN_SOURCES) {
    console.warn(`Warning: Only ${bySource.size} sources available (recommend ${MIN_SOURCES}+)`);
  } else {
    console.log(`Source diversity: ${bySource.size} unique sources`);
  }

  return balanced;
}

// Count headlines by category
function countByCategory(headlines: NewsHeadline[]): Partial<Record<Category, number>> {
  const counts: Partial<Record<Category, number>> = {};
  for (const h of headlines) {
    if (h.category) {
      counts[h.category] = (counts[h.category] || 0) + 1;
    }
  }
  return counts;
}

// Count headlines by region
function countByRegion(headlines: NewsHeadline[]): Partial<Record<Region, number>> {
  const counts: Partial<Record<Region, number>> = {};
  for (const h of headlines) {
    if (h.region) {
      counts[h.region] = (counts[h.region] || 0) + 1;
    }
  }
  return counts;
}

// Validate the daily news output
function validateDailyNews(news: DailyNews): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check summary length
  if (news.summary.length < 150) {
    warnings.push(`Summary is too short (${news.summary.length} chars, recommend 150+)`);
  }
  if (news.summary.length > 1500) {
    warnings.push(`Summary is too long (${news.summary.length} chars, recommend <1500)`);
  }

  // Check headline count
  if (news.headlines.length < 4) {
    warnings.push(`Too few headlines (${news.headlines.length}, recommend 4+)`);
  }
  if (news.headlines.length > 15) {
    warnings.push(`Too many headlines (${news.headlines.length}, recommend <15)`);
  }

  // Check for duplicate headlines
  const titles = news.headlines.map(h => h.title.toLowerCase());
  const uniqueTitles = new Set(titles);
  if (uniqueTitles.size < titles.length) {
    warnings.push(`Duplicate headlines detected (${titles.length - uniqueTitles.size} duplicates)`);
  }

  // Check source diversity
  const sources = new Set(news.headlines.map(h => h.source));
  if (sources.size < 3) {
    warnings.push(`Low source diversity (${sources.size} unique sources, recommend 3+)`);
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('Validation warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  } else {
    console.log('Validation passed: No warnings');
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}

async function runPipeline(languageCode: string = 'en') {
  try {
    // Dynamically import modules AFTER env is loaded so LLM client picks up the correct key
    const { fetchAllNews, deduplicateArticles } = await import('../src/lib/news-fetcher');
    const { filterAndRankArticles, generateHeadlines, generateDailySummary, categorizeHeadlines } = await import('../src/lib/llm-client');
    const { getDateString, saveDailyNews } = await import('../src/lib/utils');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting daily news pipeline for language: ${languageCode.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. Fetch RSS feeds
    console.log('Step 1/7: Fetching RSS feeds...');
    const rawArticles = await withTimeout(fetchAllNews(languageCode), 60000, 'RSS fetching');
    if (rawArticles.length === 0) {
      throw new Error('No articles fetched from RSS feeds');
    }
    console.log(`  Fetched ${rawArticles.length} articles\n`);

    // 2. Deduplicate articles
    console.log('Step 2/7: Deduplicating articles...');
    const uniqueArticles = await deduplicateArticles(rawArticles);
    console.log(`  Unique articles: ${uniqueArticles.length} (removed ${rawArticles.length - uniqueArticles.length} duplicates)\n`);

    // 3. Ensure source diversity
    console.log('Step 3/7: Ensuring source diversity...');
    const balancedArticles = ensureSourceDiversity(uniqueArticles);
    console.log(`  Balanced articles: ${balancedArticles.length}\n`);

    // 4. Filter and rank with AI
    console.log('Step 4/7: Filtering and ranking articles with AI...');
    const filteredArticles = await withTimeout(filterAndRankArticles(balancedArticles, languageCode), 180000, 'AI filtering');

    if (filteredArticles.length === 0) {
      throw new Error('No relevant articles after AI filtering');
    }
    console.log(`  Filtered articles: ${filteredArticles.length}\n`);

    // 5. Generate headlines with AI
    console.log('Step 5/7: Generating headlines with AI...');
    const headlines = await withTimeout(generateHeadlines(filteredArticles, languageCode), 180000, 'Headlines generation');
    console.log(`  Generated ${headlines.length} headlines\n`);

    // 6. Categorize headlines
    console.log('Step 6/7: Categorizing headlines...');
    const categorizedHeadlines = await withTimeout(categorizeHeadlines(headlines, languageCode), 60000, 'Categorization');
    const categoryCounts = countByCategory(categorizedHeadlines);
    const regionCounts = countByRegion(categorizedHeadlines);
    console.log(`  Categories: ${JSON.stringify(categoryCounts)}`);
    console.log(`  Regions: ${JSON.stringify(regionCounts)}\n`);

    // 7. Generate summary with AI
    console.log('Step 7/7: Generating daily summary with AI...');
    const summary = await withTimeout(generateDailySummary(categorizedHeadlines, languageCode), 180000, 'Summary generation');
    console.log(`  Summary length: ${summary.length} characters`);
    console.log(`  Preview: ${summary.substring(0, 100)}...\n`);

    // Create daily news object with metadata
    const today = getDateString(new Date());
    const dailyNews: DailyNews = {
      date: today,
      summary,
      headlines: categorizedHeadlines,
      metadata: {
        sourcesUsed: new Set(filteredArticles.map(a => a.source)).size,
        articlesProcessed: rawArticles.length,
        categoryCounts,
        regionCounts,
      },
    };

    // Validate output
    console.log('Validating output...');
    const validation = validateDailyNews(dailyNews);

    // Save to JSON file
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

  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`ERROR in daily news pipeline for ${languageCode}:`);
    console.error(`${'='.repeat(60)}`);
    console.error(error);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Check if required environment variables are set
if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

console.log('Environment variables validated');

// Get language from command line args, default to 'en'
const args = process.argv.slice(2);
const languageArg = args.find(arg => arg.startsWith('--lang='));
const languageCode = languageArg ? languageArg.split('=')[1] : 'en';

console.log(`Running pipeline for language: ${languageCode}`);

// Run the pipeline
runPipeline(languageCode).then(() => {
  console.log('All operations completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});
