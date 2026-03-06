import { afterEach, describe, expect, it } from 'bun:test';
import { GET } from './route';

const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
const originalCronSecret = process.env.CRON_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalOpenRouterApiKey === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
  }

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

describe('/api/health', () => {
  it('returns 503 when required production configuration is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENROUTER_API_KEY = 'key';
    delete process.env.CRON_SECRET;

    const response = await GET();
    expect(response.status).toBe(503);

    const body = await response.json();
    expect(body.status).toBe('degraded');
  });

  it('returns 200 when required production configuration is present', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENROUTER_API_KEY = 'key';
    process.env.CRON_SECRET = 'secret';

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
