import type { NextRequest } from 'next/server';

export interface CronAuthorizationResult {
  authorized: boolean;
  error?: string;
  status?: number;
}

export function authorizeCronRequest(request: NextRequest): CronAuthorizationResult {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return {
        authorized: false,
        error: 'CRON_SECRET is not configured',
        status: 503,
      };
    }

    return { authorized: true };
  }

  const authHeader = request.headers.get('authorization');
  const headerSecret = request.headers.get('x-cron-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (
    authHeader === `Bearer ${cronSecret}` ||
    headerSecret === cronSecret ||
    querySecret === cronSecret
  ) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: 'Unauthorized',
    status: 401,
  };
}
