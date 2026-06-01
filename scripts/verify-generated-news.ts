#!/usr/bin/env bun

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DailyNews } from '../src/types/news';
import { getDateString } from '../src/lib/date-utils';
import { SUPPORTED_LANGUAGE_CODES, type LanguageCode } from '../src/lib/languages';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find(arg => arg.startsWith(prefix))?.slice(prefix.length);
}

function readDailyNews(date: string, language: LanguageCode): DailyNews {
  const filePath = join(process.cwd(), 'data', language, `${date}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Missing generated file: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, 'utf-8')) as DailyNews;
}

const date = argValue('date') ?? getDateString(new Date());
const failures: string[] = [];

for (const language of SUPPORTED_LANGUAGE_CODES) {
  try {
    const news = readDailyNews(date, language);

    if (news.unavailable) {
      failures.push(`${language}: generated file is marked unavailable`);
    }

    if (!news.summary || news.summary.trim().length < 150) {
      failures.push(`${language}: summary is missing or too short`);
    }

    if (!Array.isArray(news.headlines) || news.headlines.length === 0) {
      failures.push(`${language}: no headlines generated`);
    }
  } catch (error) {
    failures.push(`${language}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error(`Generated news verification failed for ${date}:`);
  failures.forEach(failure => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`Generated news verification passed for ${date}`);
