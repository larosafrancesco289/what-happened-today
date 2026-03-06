import { NextRequest, NextResponse } from 'next/server';
import { loadDailyNews } from '@/lib/utils';
import { isValidDateString } from '@/lib/date-utils';
import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '@/lib/languages';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const language = searchParams.get('language') || DEFAULT_LANGUAGE_CODE;

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    if (!isValidDateString(date)) {
      return NextResponse.json(
        { error: 'Invalid date. Expected a real calendar date in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    if (!isSupportedLanguageCode(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Expected one of en, it, fr' },
        { status: 400 }
      );
    }

    const data = await loadDailyNews(date, language);

    if (!data) {
      return NextResponse.json(
        { error: 'No data found for the specified date and language' },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        // Cache for 5 minutes at the edge; allow stale for a day
        'Cache-Control': 's-maxage=300, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Error fetching daily news:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
