import { NextRequest, NextResponse } from 'next/server';
import { getDailySummary } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const language = searchParams.get('language') || 'en';

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const data = await getDailySummary(date, language);

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
