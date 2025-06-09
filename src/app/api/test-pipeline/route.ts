import { NextResponse } from 'next/server';
import { getDateString, saveDailyNews } from '@/lib/utils';
import type { DailyNews, NewsHeadline } from '@/types/news';

export async function GET() {
  try {
    console.log('Running test pipeline with mock data...');
    
    // Mock headlines for testing
    const mockHeadlines: NewsHeadline[] = [
      {
        title: "Global Markets Show Steady Growth in Technology Sector",
        source: "Reuters",
        summary: "International stock markets demonstrated consistent gains as technology companies reported strong quarterly earnings. Major indices across Asia, Europe, and America posted modest increases.",
        link: "https://example.com/tech-growth"
      },
      {
        title: "International Climate Conference Reaches Key Agreements",
        source: "BBC",
        summary: "Delegates from 50 countries concluded discussions on renewable energy initiatives. New frameworks for carbon reduction were established with implementation timelines through 2025.",
        link: "https://example.com/climate-conference"
      },
      {
        title: "Healthcare Innovation Partnerships Expand Globally",
        source: "Associated Press",
        summary: "Medical research institutions announced collaborative projects focused on treatment accessibility. Cross-border healthcare technology sharing agreements were formalized.",
        link: "https://example.com/healthcare-innovation"
      }
    ];
    
    // Mock summary
    const mockSummary = "Global markets demonstrated resilience today as technology sector earnings exceeded expectations across multiple regions. International cooperation on climate initiatives continued to strengthen with new agreements on renewable energy frameworks. Healthcare innovation partnerships expanded their reach through formalized cross-border collaboration agreements.\n\nThese developments reflect ongoing stability in key economic sectors while institutional cooperation addresses long-term challenges. Market indicators suggest continued confidence in technological advancement and sustainable development initiatives as priority areas for international investment and policy coordination.";
    
    // Create daily news object
    const today = getDateString(new Date());
    const dailyNews: DailyNews = {
      date: today,
      summary: mockSummary,
      headlines: mockHeadlines,
    };
    
    // Save to JSON file
    await saveDailyNews(dailyNews);
    
    console.log(`Successfully generated test daily news for ${today}`);
    
    return NextResponse.json({
      success: true,
      date: today,
      mode: 'test',
      headlinesGenerated: mockHeadlines.length,
      message: 'Test pipeline completed successfully',
      data: dailyNews,
    });
    
  } catch (error) {
    console.error('Error in test pipeline:', error);
    
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