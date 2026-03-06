import { NextRequest, NextResponse } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { SUPPORTED_LANGUAGE_CODES, isSupportedLanguageCode, type LanguageCode } from '@/lib/languages';
import { runDailyPipelineSafely, type DailyPipelineResult } from '@/lib/pipeline/daily';

function resolveRequestedLanguages(request: NextRequest): LanguageCode[] | null {
  const requestedLanguage = request.nextUrl.searchParams.get('language');

  if (!requestedLanguage || requestedLanguage === 'all') {
    return [...SUPPORTED_LANGUAGE_CODES];
  }

  if (!isSupportedLanguageCode(requestedLanguage)) {
    return null;
  }

  return [requestedLanguage];
}

async function handleCronRequest(request: NextRequest) {
  try {
    const authorization = authorizeCronRequest(request);
    if (!authorization.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: authorization.error,
        },
        {
          status: authorization.status ?? 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const requestedLanguages = resolveRequestedLanguages(request);
    if (!requestedLanguages) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid language. Expected one of ${SUPPORTED_LANGUAGE_CODES.join(', ')} or "all"`,
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      );
    }

    const results: DailyPipelineResult[] = [];
    for (const language of requestedLanguages) {
      results.push(await runDailyPipelineSafely(language));
    }

    const success = results.every(result => result.success);
    const status = success ? 200 : 207;

    return NextResponse.json(
      {
        success,
        generatedAt: new Date().toISOString(),
        requestedLanguage: request.nextUrl.searchParams.get('language') ?? 'all',
        results,
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('Error handling cron request:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        generatedAt: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCronRequest(request);
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request);
}
