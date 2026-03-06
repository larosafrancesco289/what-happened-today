import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import type { WeeklyDigest } from '@/types/news';
import { loadJsonFile } from '@/lib/utils';
import { isValidWeekId } from '@/lib/date-utils';
import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '@/lib/languages';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const weekId = searchParams.get('weekId');
    const language = searchParams.get('language') || DEFAULT_LANGUAGE_CODE;

    if (!weekId) {
      return NextResponse.json(
        { error: 'weekId parameter is required (e.g., 2026-W06)' },
        { status: 400 }
      );
    }

    if (!isValidWeekId(weekId)) {
      return NextResponse.json(
        { error: 'Invalid weekId. Expected a real ISO week in YYYY-WXX format (e.g., 2026-W06)' },
        { status: 400 }
      );
    }

    if (!isSupportedLanguageCode(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Expected one of en, it, fr' },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), 'data', language, `week-${weekId}.json`);

    const data = await loadJsonFile<WeeklyDigest>(filePath);
    if (!data) {
      return NextResponse.json(
        { error: 'No weekly digest found for the specified week and language' },
        { status: 404 }
      );
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
      }
    });
  } catch (error) {
    console.error('Error fetching weekly digest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
