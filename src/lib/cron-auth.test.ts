import { afterEach, describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';
import { authorizeCronRequest } from './cron-auth';

const originalCronSecret = process.env.CRON_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

function buildRequest(url: string, headers?: HeadersInit): NextRequest {
  return new NextRequest(url, {
    headers,
  });
}

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }

  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

describe('authorizeCronRequest', () => {
  it('allows local development when no cron secret is configured', () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'development';

    const result = authorizeCronRequest(buildRequest('https://example.com/api/cron'));
    expect(result).toEqual({ authorized: true });
  });

  it('blocks production requests when the cron secret is missing', () => {
    delete process.env.CRON_SECRET;
    process.env.NODE_ENV = 'production';

    const result = authorizeCronRequest(buildRequest('https://example.com/api/cron'));
    expect(result).toEqual({
      authorized: false,
      error: 'CRON_SECRET is not configured',
      status: 503,
    });
  });

  it('accepts the configured secret through standard auth channels', () => {
    process.env.CRON_SECRET = 'top-secret';
    process.env.NODE_ENV = 'production';

    const bearerRequest = buildRequest('https://example.com/api/cron', {
      authorization: 'Bearer top-secret',
    });
    expect(authorizeCronRequest(bearerRequest)).toEqual({ authorized: true });

    const queryRequest = buildRequest('https://example.com/api/cron?secret=top-secret');
    expect(authorizeCronRequest(queryRequest)).toEqual({ authorized: true });
  });

  it('rejects requests with the wrong secret', () => {
    process.env.CRON_SECRET = 'top-secret';
    process.env.NODE_ENV = 'production';

    const result = authorizeCronRequest(buildRequest('https://example.com/api/cron', {
      authorization: 'Bearer wrong-secret',
    }));

    expect(result).toEqual({
      authorized: false,
      error: 'Unauthorized',
      status: 401,
    });
  });
});
