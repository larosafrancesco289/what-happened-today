#!/usr/bin/env bun

import type { DailyNews, WeeklyDigest, Category, Region } from '../src/types/news';
import { withTimeout, safeParseJSON } from '../src/lib/utils';

/** Get the Monday–Sunday range for the most recently completed week. */
function getLastWeekRange(referenceDate: Date = new Date()): { startDate: string; endDate: string; weekId: string } {
  const d = new Date(referenceDate);
  // Roll back to last Sunday (end of previous week)
  const dayOfWeek = d.getDay(); // 0=Sun
  const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  d.setDate(d.getDate() - daysToLastSunday);
  const endDate = d.toISOString().split('T')[0];

  // Monday of that week = Sunday - 6
  const monday = new Date(d);
  monday.setDate(monday.getDate() - 6);
  const startDate = monday.toISOString().split('T')[0];

  // ISO week number
  const jan4 = new Date(monday.getFullYear(), 0, 4);
  const daysSinceJan4 = Math.floor((monday.getTime() - jan4.getTime()) / 86400000);
  const weekNum = Math.ceil((daysSinceJan4 + jan4.getDay() + 1) / 7);
  const weekId = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  return { startDate, endDate, weekId };
}

/** Generate all dates between start and end (inclusive), as YYYY-MM-DD strings. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function runWeeklyPipeline(languageCode: string = 'en') {
  const { loadDailyNews } = await import('../src/lib/utils');
  const fs = await import('fs');
  const path = await import('path');

  const { startDate, endDate, weekId } = getLastWeekRange();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Weekly digest: ${weekId} (${startDate} → ${endDate}) [${languageCode.toUpperCase()}]`);
  console.log(`${'='.repeat(60)}\n`);

  // 1. Load daily JSON files
  const dates = dateRange(startDate, endDate);
  const dailyData: DailyNews[] = [];

  for (const date of dates) {
    const data = await loadDailyNews(date, languageCode);
    if (data && !data.unavailable && data.headlines.length > 0) {
      dailyData.push(data);
      console.log(`  Loaded ${date}: ${data.headlines.length} headlines`);
    } else {
      console.log(`  Skipped ${date}: no data or unavailable`);
    }
  }

  if (dailyData.length === 0) {
    console.error('No daily data found for the week. Aborting.');
    process.exit(1);
  }

  // 2. Collect top-tier headlines
  const topHeadlines: WeeklyDigest['topHeadlines'] = [];
  for (const day of dailyData) {
    for (const h of day.headlines) {
      if (h.tier === 'top' || (!h.tier && day.headlines.indexOf(h) < 3)) {
        topHeadlines.push({
          date: day.date,
          title: h.title,
          category: h.category,
          region: h.region,
        });
      }
    }
  }

  // 3. Identify persistent stories (title words appearing on 3+ days)
  const titlesByDay = dailyData.map(d => d.headlines.map(h => h.title.toLowerCase()));
  const titleCounts = new Map<string, Set<number>>();
  for (let dayIdx = 0; dayIdx < titlesByDay.length; dayIdx++) {
    for (const title of titlesByDay[dayIdx]) {
      // Normalize: take first 6 significant words
      const key = title.replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
      if (!titleCounts.has(key)) titleCounts.set(key, new Set());
      titleCounts.get(key)!.add(dayIdx);
    }
  }

  // Find stories that span 3+ days, return original title from first appearance
  const persistentStories: string[] = [];
  const seenKeys = new Set<string>();
  for (const day of dailyData) {
    for (const h of day.headlines) {
      const key = h.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
      if (!seenKeys.has(key) && (titleCounts.get(key)?.size ?? 0) >= 3) {
        persistentStories.push(h.title);
        seenKeys.add(key);
      }
    }
  }

  // 4. Aggregate stats
  let totalArticlesProcessed = 0;
  const allSources = new Set<number>();
  const categoryCounts: Partial<Record<Category, number>> = {};
  const regionCounts: Partial<Record<Region, number>> = {};

  for (const day of dailyData) {
    totalArticlesProcessed += day.metadata?.articlesProcessed ?? 0;
    allSources.add(day.metadata?.sourcesUsed ?? 0);
    for (const h of day.headlines) {
      if (h.category) categoryCounts[h.category] = (categoryCounts[h.category] ?? 0) + 1;
      if (h.region) regionCounts[h.region] = (regionCounts[h.region] ?? 0) + 1;
    }
  }

  // Total unique sources = max across days (rough approximation)
  const totalSourcesUsed = Math.max(...Array.from(allSources));

  // 5. Generate weekly summary via LLM
  console.log('\nGenerating weekly summary with LLM...');
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY?.trim(),
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 90000,
    maxRetries: 2,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://what-happened-today.vercel.app',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'What Happened Today',
    },
  });

  const MODEL_SUMMARY = 'x-ai/grok-4.1-fast';

  const headlinesByDay = dailyData.map(d =>
    `${d.date}:\n${d.headlines.filter(h => h.tier === 'top' || !h.tier).map(h => `  - ${h.title}`).join('\n')}`
  ).join('\n\n');

  const persistentSection = persistentStories.length > 0
    ? `\nPERSISTENT STORIES (appeared 3+ days):\n${persistentStories.map(s => `  - ${s}`).join('\n')}\n`
    : '';

  const langPrompts: Record<string, { system: string; user: string }> = {
    en: {
      system: 'You are a neutral news editor. Write in clear English. Output valid JSON only.',
      user: `Write a 300-400 word weekly news briefing covering ${startDate} to ${endDate}. Summarize what mattered, what developed, and what resolved.

${headlinesByDay}
${persistentSection}
RULES:
- Neutral, factual tone
- Cover the most significant stories first
- Note stories that persisted or developed across the week
- Mention specific dates, names, numbers
- No editorializing

Output JSON: {"summary":"<your briefing>"}`,
    },
    it: {
      system: 'Sei un redattore neutrale. Scrivi in italiano chiaro. Output solo JSON valido.',
      user: `Scrivi un briefing settimanale di 300-400 parole che copra dal ${startDate} al ${endDate}. Riassumi cosa è stato importante, cosa si è sviluppato e cosa si è risolto.

${headlinesByDay}
${persistentSection}
REGOLE:
- Tono neutrale e fattuale
- Copri prima le storie più significative
- Nota le storie persistenti o in sviluppo durante la settimana
- Menziona date specifiche, nomi, numeri
- Nessuna editorializzazione

Output JSON: {"summary":"<il tuo briefing>"}`,
    },
    fr: {
      system: 'Vous êtes un rédacteur neutre. Écrivez en français clair. Output JSON valide uniquement.',
      user: `Rédigez un briefing hebdomadaire de 300-400 mots couvrant du ${startDate} au ${endDate}. Résumez ce qui a compté, ce qui s'est développé et ce qui s'est résolu.

${headlinesByDay}
${persistentSection}
RÈGLES:
- Ton neutre et factuel
- Couvrez d'abord les histoires les plus significatives
- Notez les histoires persistantes ou en développement au cours de la semaine
- Mentionnez des dates, noms et chiffres spécifiques
- Pas d'éditorialisation

Output JSON: {"summary":"<votre briefing>"}`,
    },
  };

  const prompts = langPrompts[languageCode] || langPrompts.en;

  const response = await withTimeout(
    client.chat.completions.create({
      model: MODEL_SUMMARY,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
      max_tokens: 2048,
    }),
    180000,
    'Weekly summary generation'
  );

  const responseText = response.choices[0]?.message?.content || '';
  const { summary } = safeParseJSON<{ summary?: string }>(responseText, {});

  if (!summary) {
    console.error('Failed to generate weekly summary. Raw response:', responseText.substring(0, 500));
    process.exit(1);
  }

  console.log(`  Summary length: ${summary.length} characters`);
  console.log(`  Preview: ${summary.substring(0, 120)}...\n`);

  // 6. Build and save weekly digest
  const digest: WeeklyDigest = {
    weekId,
    startDate,
    endDate,
    summary,
    persistentStories,
    topHeadlines,
    metadata: {
      totalArticlesProcessed,
      totalSourcesUsed,
      daysWithData: dailyData.length,
      categoryCounts,
      regionCounts,
    },
  };

  const outPath = path.join(process.cwd(), 'data', languageCode, `week-${weekId}.json`);
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  await fs.promises.writeFile(outPath, JSON.stringify(digest, null, 2));

  console.log(`${'='.repeat(60)}`);
  console.log(`SUCCESS: Weekly digest saved to ${outPath}`);
  console.log(`  Days with data: ${dailyData.length}/7`);
  console.log(`  Top headlines: ${topHeadlines.length}`);
  console.log(`  Persistent stories: ${persistentStories.length}`);
  console.log(`  Total articles processed: ${totalArticlesProcessed}`);
  console.log(`${'='.repeat(60)}\n`);
}

// Validate environment
if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

// Parse language arg
const args = process.argv.slice(2);
const languageArg = args.find(arg => arg.startsWith('--lang='));
const languageCode = languageArg ? languageArg.split('=')[1] : 'en';

console.log(`Running weekly digest for language: ${languageCode}`);

runWeeklyPipeline(languageCode).then(() => {
  console.log('Weekly digest completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('Weekly digest failed:', error);
  process.exit(1);
});
