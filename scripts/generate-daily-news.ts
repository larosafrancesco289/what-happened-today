#!/usr/bin/env node

// Standalone script to generate daily news for GitHub Actions
// This script imports the necessary functions and runs the pipeline directly

import { fetchAllNews, deduplicateArticles } from '../src/lib/news-fetcher.js';
import { filterAndRankArticles, generateHeadlines, generateDailySummary } from '../src/lib/openai.js';
import { getDateString, saveDailyNews } from '../src/lib/utils.js';

// Import required modules
async function runPipeline() {
  try {

    console.log('🚀 Starting daily news pipeline...');
    
    // 1. Fetch RSS feeds
    console.log('📡 Fetching RSS feeds...');
    const rawArticles = await fetchAllNews();
    if (rawArticles.length === 0) {
      throw new Error('No articles fetched from RSS feeds');
    }
    console.log(`📄 Fetched ${rawArticles.length} articles`);
    
    // 2. Deduplicate articles
    console.log('🔄 Deduplicating articles...');
    const uniqueArticles = await deduplicateArticles(rawArticles);
    console.log(`✨ Unique articles: ${uniqueArticles.length}`);
    
    // 3. Filter and rank with AI
    console.log('🤖 Filtering and ranking articles with AI...');
    const filteredArticles = await filterAndRankArticles(uniqueArticles);
    
    if (filteredArticles.length === 0) {
      throw new Error('No relevant articles after AI filtering');
    }
    console.log(`🎯 Filtered articles: ${filteredArticles.length}`);
    
    // 4. Generate headlines with AI
    console.log('📰 Generating headlines with AI...');
    const headlines = await generateHeadlines(filteredArticles);
    console.log(`🏆 Generated ${headlines.length} headlines`);
    
    // 5. Generate summary with AI
    console.log('📝 Generating daily summary with AI...');
    const summary = await generateDailySummary(headlines);
    
    // 6. Create daily news object
    const today = getDateString(new Date());
    const dailyNews = {
      date: today,
      summary,
      headlines,
    };
    
    // 7. Save to JSON file
    console.log('💾 Saving daily news...');
    await saveDailyNews(dailyNews);
    
    console.log(`✅ Successfully generated daily news for ${today}`);
    console.log(`📰 Headlines: ${headlines.length} stories`);
    console.log(`📝 Summary: ${summary.substring(0, 100)}...`);
    
    return {
      success: true,
      date: today,
      articlesProcessed: rawArticles.length,
      headlinesGenerated: headlines.length,
    };
    
  } catch (error) {
    console.error('❌ Error in daily news pipeline:', error);
    console.error('Stack trace:', (error as Error).stack);
    process.exit(1);
  }
}

// Check if required environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Run the pipeline
runPipeline(); 