import fs from 'node:fs';
import path from 'node:path';
import type { Lang } from './languages';

export interface Story {
  title: string;
  summary: string;
  link: string;
  source: string;
  publishedAt?: string;
  /** Other outlets covering the same story, with links. */
  coverage?: { source: string; link: string }[];
  /** Older editions list covering outlets by name only. */
  sources?: string[];
}

export interface Edition {
  date: string;
  summary: string;
  headlines: Story[];
  metadata?: Record<string, unknown>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const EDITION_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

function editionPath(lang: Lang, date: string): string {
  return path.join(DATA_DIR, lang, `${date}.json`);
}

export function readEdition(lang: Lang, date: string): Edition {
  return JSON.parse(fs.readFileSync(editionPath(lang, date), 'utf8'));
}

export function writeEdition(lang: Lang, edition: Edition): void {
  fs.mkdirSync(path.join(DATA_DIR, lang), { recursive: true });
  fs.writeFileSync(editionPath(lang, edition.date), `${JSON.stringify(edition, null, 2)}\n`);
}

const datesCache = new Map<Lang, string[]>();

/** Dates with a readable edition, oldest first. Placeholder files from failed runs are skipped. */
export function listDates(lang: Lang): string[] {
  const cached = datesCache.get(lang);
  if (cached) return cached;

  const dates = fs.readdirSync(path.join(DATA_DIR, lang))
    .filter(file => EDITION_FILE.test(file))
    .map(file => file.slice(0, 10))
    .filter(date => {
      const edition = readEdition(lang, date);
      return edition.summary && edition.headlines?.length > 0;
    })
    .sort();

  datesCache.set(lang, dates);
  return dates;
}
