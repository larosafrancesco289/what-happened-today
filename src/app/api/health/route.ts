import { NextResponse } from 'next/server';
import { SUPPORTED_LANGUAGE_CODES } from '@/lib/languages';

export async function GET() {
  const checks = {
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET),
  };

  const healthy = checks.openRouterConfigured && (process.env.NODE_ENV !== 'production' || checks.cronSecretConfigured);
  const status = healthy ? 200 : 503;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
