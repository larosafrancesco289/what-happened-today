import { NextResponse } from 'next/server';
import { fetchAllNews, deduplicateArticles } from '@/lib/news-fetcher';
import { filterAndRankArticles, generateHeadlines, generateDailySummary } from '@/lib/openai';
import { getDateString, saveDailyNews } from '@/lib/utils';
import type { DailyNews } from '@/types/news';

export async function GET() {
  try {
    console.log('Starting daily news pipeline...');
    
    // 1. Fetch RSS feeds
    const rawArticles = await fetchAllNews();
    if (rawArticles.length === 0) {
      throw new Error('No articles fetched from RSS feeds');
    }
    
    // 2. Deduplicate articles
    const uniqueArticles = await deduplicateArticles(rawArticles);
    
    // 3. Filter and rank with AI
    console.log('Filtering and ranking articles with AI...');
    const filteredArticles = await filterAndRankArticles(uniqueArticles);
    
    if (filteredArticles.length === 0) {
      throw new Error('No relevant articles after AI filtering');
    }
    
    // 4. Generate headlines with AI
    console.log('Generating headlines with AI...');
    const headlines = await generateHeadlines(filteredArticles);
    
    // 5. Generate summary with AI
    console.log('Generating daily summary with AI...');
    const summary = await generateDailySummary(headlines);
    
    // 6. Create daily news object
    const today = getDateString(new Date());
    const dailyNews: DailyNews = {
      date: today,
      summary,
      headlines,
    };
    
    // 7. Save to JSON file
    await saveDailyNews(dailyNews);
    
    console.log(`Successfully generated daily news for ${today}`);
    console.log(`Summary: ${summary.substring(0, 100)}...`);
    console.log(`Headlines: ${headlines.length} stories`);
    
    return NextResponse.json({
      success: true,
      date: today,
      articlesProcessed: rawArticles.length,
      headlinesGenerated: headlines.length,
      message: 'Daily news pipeline completed successfully',
    });
    
  } catch (error) {
    console.error('Error in daily news pipeline:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Add a POST method for manual triggering
export async function POST() {
  return GET();
} 