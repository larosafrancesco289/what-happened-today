import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { WeeklyDigest } from '@/types/news';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    const language = searchParams.get('language') || 'en';

    if (!weekId) {
      return NextResponse.json(
        { error: 'weekId parameter is required (e.g., 2026-W06)' },
        { status: 400 }
      );
    }

    // Validate weekId format (YYYY-WXX)
    const weekRegex = /^\d{4}-W\d{2}$/;
    if (!weekRegex.test(weekId)) {
      return NextResponse.json(
        { error: 'Invalid weekId format. Expected YYYY-WXX (e.g., 2026-W06)' },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), 'data', language, `week-${weekId}.json`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const data: WeeklyDigest = JSON.parse(content);

      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
        }
      });
    } catch {
      return NextResponse.json(
        { error: 'No weekly digest found for the specified week and language' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error fetching weekly digest:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
