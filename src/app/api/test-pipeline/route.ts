import { NextRequest, NextResponse } from 'next/server';
import { getDateString, saveDailyNews } from '@/lib/utils';
import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '@/lib/languages';
import type { DailyNews, NewsHeadline } from '@/types/news';

function buildMockDailyNews(date: string): DailyNews {
  const mockHeadlines: NewsHeadline[] = [
    {
      title: 'Global Markets Show Steady Growth in Technology Sector',
      source: 'Reuters',
      summary: 'International stock markets posted moderate gains after technology companies reported strong earnings. Major indices across Asia, Europe, and the Americas moved higher as investors watched the next round of central bank guidance.',
      link: 'https://example.com/tech-growth',
      tier: 'top',
      category: 'economy',
      region: 'global',
      importance: 'major',
      sources: ['Reuters'],
      singleSource: true,
    },
    {
      title: 'International Climate Conference Reaches New Renewable Energy Agreement',
      source: 'BBC',
      summary: 'Delegates from 50 countries agreed on updated renewable energy targets and financing milestones. The deal gives governments a new timeline for reporting progress and expands support for grid infrastructure.',
      link: 'https://example.com/climate-conference',
      tier: 'also',
      category: 'environment',
      region: 'global',
      importance: 'notable',
      sources: ['BBC'],
      singleSource: true,
    },
    {
      title: 'Medical Research Networks Expand Cross-Border Data Sharing Partnership',
      source: 'Associated Press',
      summary: 'Hospitals and public research institutes announced a shared framework for treatment studies and data exchange. The move is intended to speed up access to trial results and improve coordination during health emergencies.',
      link: 'https://example.com/healthcare-innovation',
      tier: 'developing',
      dayNumber: 2,
      previousContext: 'Researchers extended the initial pilot program into a formal multi-country network',
      category: 'science',
      region: 'global',
      importance: 'notable',
      sources: ['Associated Press'],
      singleSource: true,
    },
  ];

  return {
    date,
    summary: 'Technology earnings helped lift global markets while policymakers reached a new climate agreement focused on renewable energy targets and infrastructure funding. Separately, public health research institutions expanded data-sharing arrangements intended to speed up international collaboration on treatment studies and emergency response planning.\n\nTogether, the updates point to steady institutional coordination across finance, climate policy, and medical research. The market move will be watched for durability in the next trading sessions, while the climate and health agreements now shift toward implementation and reporting milestones.',
    headlines: mockHeadlines,
    metadata: {
      sourcesUsed: 3,
      articlesProcessed: 3,
      articlesAfterDedup: 3,
      articlesAfterDiversity: 3,
      articlesAfterFilter: 3,
      categoryCounts: {
        economy: 1,
        environment: 1,
        science: 1,
      },
      regionCounts: {
        global: 3,
      },
      tierCounts: {
        top: 1,
        also: 1,
        developing: 1,
      },
    },
  };
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: 'Test pipeline is only available outside production',
      },
      { status: 404 },
    );
  }

  try {
    const requestedLanguage = request.nextUrl.searchParams.get('language') || DEFAULT_LANGUAGE_CODE;
    if (!isSupportedLanguageCode(requestedLanguage)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid language. Expected one of en, it, fr',
        },
        { status: 400 },
      );
    }

    console.log('Running test pipeline with mock data...');

    const today = getDateString(new Date());
    const dailyNews = buildMockDailyNews(today);

    await saveDailyNews(dailyNews, requestedLanguage);

    console.log(`Successfully generated test daily news for ${today} (${requestedLanguage})`);

    return NextResponse.json(
      {
        success: true,
        date: today,
        language: requestedLanguage,
        mode: 'test',
        headlinesGenerated: dailyNews.headlines.length,
        message: 'Test pipeline completed successfully',
        data: dailyNews,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Error in test pipeline:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
