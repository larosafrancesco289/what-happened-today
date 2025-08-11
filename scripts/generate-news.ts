#!/usr/bin/env node

// Ensure environment variables are loaded before any other imports
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Prefer .env.local (Next.js convention) and fallback to .env
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  // Ensure local file values override any shell-exported vars (useful when a stale OPENAI_API_KEY is exported)
  dotenv.config({ path: envLocalPath, override: true });
} else {
  dotenv.config({ override: true });
}

// Standalone script to generate daily news for GitHub Actions
// IMPORTANT: We dynamically import dependencies AFTER loading env so the correct
// OPENAI_API_KEY from .env.local is used when initializing the OpenAI client.

// Helper function to add timeout to promises
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function runPipeline(languageCode: string = 'en') {
  try {
    // Dynamically import modules AFTER env is loaded so OpenAI client picks up the correct key
    const { fetchAllNews, deduplicateArticles } = await import('../src/lib/news-fetcher');
    const { filterAndRankArticles, generateHeadlines, generateDailySummary } = await import('../src/lib/openai');
    const { getDateString, saveDailyNews } = await import('../src/lib/utils');

    console.log(`Starting daily news pipeline for language: ${languageCode}...`);
    
    // 1. Fetch RSS feeds
    console.log('Fetching RSS feeds...');
    const rawArticles = await withTimeout(fetchAllNews(languageCode), 30000, 'RSS fetching');
    if (rawArticles.length === 0) {
      throw new Error('No articles fetched from RSS feeds');
    }
    console.log(`Fetched ${rawArticles.length} articles`);
    
    // 2. Deduplicate articles
    console.log('Deduplicating articles...');
    const uniqueArticles = await deduplicateArticles(rawArticles);
    console.log(`Unique articles: ${uniqueArticles.length}`);
    
    // 3. Filter and rank with AI
    console.log('Filtering and ranking articles with AI...');
    const filteredArticles = await withTimeout(filterAndRankArticles(uniqueArticles, languageCode), 180000, 'AI filtering');
    
    if (filteredArticles.length === 0) {
      throw new Error('No relevant articles after AI filtering');
    }
    console.log(`Filtered articles: ${filteredArticles.length}`);
    
    // 4. Generate headlines with AI
    console.log('Generating headlines with AI...');
    const headlines = await withTimeout(generateHeadlines(filteredArticles, languageCode), 180000, 'Headlines generation');
    console.log(`Generated ${headlines.length} headlines`);
    
    // 5. Generate summary with AI
    console.log('Generating daily summary with AI...');
    console.log('Starting summary generation call...');
    const summary = await withTimeout(generateDailySummary(headlines, languageCode), 180000, 'Summary generation');
    console.log('Summary generation completed!');
    console.log(`Summary preview: ${summary.substring(0, 100)}...`);
    
    // 6. Create daily news object
    console.log('Creating daily news object...');
    const today = getDateString(new Date());
    const dailyNews = {
      date: today,
      summary,
      headlines,
    };
    console.log(`Daily news object created for date: ${today}`);
    
    // 7. Save to JSON file
    console.log('Saving daily news...');
    console.log(`Saving to file system...`);
    await withTimeout(saveDailyNews(dailyNews, languageCode), 10000, 'File saving');
    console.log('File saved successfully!');
    
    console.log(`Successfully generated daily news for ${today} (${languageCode})`);
    console.log(`Headlines: ${headlines.length} stories`);
    console.log(`Summary: ${summary.substring(0, 100)}...`);
    
    console.log('Pipeline completed successfully!');
    
    return {
      success: true,
      date: today,
      language: languageCode,
      articlesProcessed: rawArticles.length,
      headlinesGenerated: headlines.length,
    };
    
  } catch (error) {
    console.error(`Error in daily news pipeline for ${languageCode}:`, error);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Check if required environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required');
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


