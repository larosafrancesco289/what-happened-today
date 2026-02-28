#!/usr/bin/env bun

import type { DailyNews, WeeklyDigest, Category, Region } from '../src/types/news';
import { withTimeout, safeParseJSON, getLastWeekRange } from '../src/lib/utils';
import { chatCompletion, recoverSummaryFromMalformedOutput, TIER_PRIORITY, MODEL_SUMMARY } from '../src/lib/llm-client';

interface StoryEntry {
  title: string;
  tiers: Map<number, string>;
}

interface ClassifiedStories {
  persistent: string[];
  faded: string[];
  escalated: string[];
}

/**
 * Classify tracked stories into persistent (3+ days), faded (1 day only),
 * and escalated (started low, ended as top story).
 */
function classifyStories(tracker: Map<string, StoryEntry>): ClassifiedStories {
  const persistent: string[] = [];
  const faded: string[] = [];
  const escalated: string[] = [];

  for (const [, entry] of tracker) {
    const dayCount = entry.tiers.size;
    const tiers = Array.from(entry.tiers.entries()).sort(([a], [b]) => a - b);
    const firstTier = tiers[0]?.[1];
    const lastTier = tiers[tiers.length - 1]?.[1];

    if (dayCount >= 3) {
      persistent.push(entry.title);
    } else if (dayCount === 1 && (firstTier === 'top' || firstTier === 'also')) {
      faded.push(entry.title);
    }

    if (dayCount >= 2 && (firstTier === 'also' || firstTier === 'developing') && lastTier === 'top') {
      escalated.push(entry.title);
    }
  }

  return { persistent, faded, escalated };
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

  // 1. Load daily JSON files in parallel
  const dates = dateRange(startDate, endDate);
  const results = await Promise.all(
    dates.map(async (date) => ({ date, data: await loadDailyNews(date, languageCode) }))
  );

  const dailyData: DailyNews[] = [];
  for (const { date, data } of results) {
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

  // 2. Collect top headlines and track each story's tier progression across days
  const topHeadlines: WeeklyDigest['topHeadlines'] = [];
  const storyTracker = new Map<string, StoryEntry>();

  for (let dayIdx = 0; dayIdx < dailyData.length; dayIdx++) {
    const day = dailyData[dayIdx];
    for (const h of day.headlines) {
      const tier = h.tier || (day.headlines.indexOf(h) < 3 ? 'top' : 'also');

      if (tier === 'top') {
        topHeadlines.push({
          date: day.date,
          title: h.title,
          category: h.category,
          region: h.region,
        });
      }

      const key = h.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).slice(0, 6).join(' ');
      if (!storyTracker.has(key)) {
        storyTracker.set(key, { title: h.title, tiers: new Map() });
      }
      const entry = storyTracker.get(key)!;
      const existing = entry.tiers.get(dayIdx);
      if (!existing || (TIER_PRIORITY[tier as keyof typeof TIER_PRIORITY] ?? 1) < (TIER_PRIORITY[existing as keyof typeof TIER_PRIORITY] ?? 1)) {
        entry.tiers.set(dayIdx, tier);
      }
    }
  }

  // 3. Classify stories by lifecycle pattern
  const { persistent: persistentStories, faded: fadedStories, escalated: escalatedStories } = classifyStories(storyTracker);

  // 4. Aggregate stats
  let totalArticlesProcessed = 0;
  let maxSourcesPerDay = 0;
  const categoryCounts: Partial<Record<Category, number>> = {};
  const regionCounts: Partial<Record<Region, number>> = {};

  for (const day of dailyData) {
    totalArticlesProcessed += day.metadata?.articlesProcessed ?? 0;
    maxSourcesPerDay = Math.max(maxSourcesPerDay, day.metadata?.sourcesUsed ?? 0);
    for (const h of day.headlines) {
      if (h.category) categoryCounts[h.category] = (categoryCounts[h.category] ?? 0) + 1;
      if (h.region) regionCounts[h.region] = (regionCounts[h.region] ?? 0) + 1;
    }
  }

  const totalSourcesUsed = maxSourcesPerDay;

  // 5. Generate weekly summary via LLM
  console.log('\nGenerating weekly summary with LLM...');

  const headlinesByDay = dailyData.map(d =>
    `${d.date}:\n${d.headlines.filter(h => h.tier === 'top' || !h.tier).map(h => `  - ${h.title}`).join('\n')}`
  ).join('\n\n');

  const persistentSection = persistentStories.length > 0
    ? `\nPERSISTENT STORIES (appeared 3+ days):\n${persistentStories.map(s => `  - ${s}`).join('\n')}\n`
    : '';

  const fadedSection = fadedStories.length > 0
    ? `\nSTORIES THAT FADED QUICKLY (appeared only 1 day):\n${fadedStories.slice(0, 5).map(s => `  - ${s}`).join('\n')}\n`
    : '';

  const escalatedSection = escalatedStories.length > 0
    ? `\nSTORIES THAT ESCALATED (grew in prominence):\n${escalatedStories.map(s => `  - ${s}`).join('\n')}\n`
    : '';

  const langPrompts: Record<string, { system: string; user: string }> = {
    en: {
      system: 'You are a neutral news editor. Write in clear English. Output valid JSON only.',
      user: `Write a 300-400 word weekly news briefing covering ${startDate} to ${endDate}. Summarize what mattered, what developed, and what resolved.

${headlinesByDay}
${persistentSection}${fadedSection}${escalatedSection}
RULES:
- Neutral, factual tone
- Cover the most significant stories first
- Note stories that persisted or developed across the week
- Briefly note which stories proved lasting vs. which faded — this helps readers calibrate their sense of what truly mattered
- Mention specific dates, names, numbers
- No editorializing

Output JSON: {"summary":"<your briefing>"}`,
    },
    it: {
      system: 'Sei un redattore neutrale. Scrivi in italiano chiaro. Output solo JSON valido.',
      user: `Scrivi un briefing settimanale di 300-400 parole che copra dal ${startDate} al ${endDate}. Riassumi cosa è stato importante, cosa si è sviluppato e cosa si è risolto.

${headlinesByDay}
${persistentSection}${fadedSection}${escalatedSection}
REGOLE:
- Tono neutrale e fattuale
- Copri prima le storie più significative
- Nota le storie persistenti o in sviluppo durante la settimana
- Nota brevemente quali storie sono durate e quali sono svanite — questo aiuta i lettori a capire cosa ha contato davvero
- Menziona date specifiche, nomi, numeri
- Nessuna editorializzazione

Output JSON: {"summary":"<il tuo briefing>"}`,
    },
    fr: {
      system: 'Vous êtes un rédacteur neutre. Écrivez en français clair. Output JSON valide uniquement.',
      user: `Rédigez un briefing hebdomadaire de 300-400 mots couvrant du ${startDate} au ${endDate}. Résumez ce qui a compté, ce qui s'est développé et ce qui s'est résolu.

${headlinesByDay}
${persistentSection}${fadedSection}${escalatedSection}
RÈGLES:
- Ton neutre et factuel
- Couvrez d'abord les histoires les plus significatives
- Notez les histoires persistantes ou en développement au cours de la semaine
- Notez brièvement quelles histoires ont duré et lesquelles ont disparu — cela aide les lecteurs à calibrer ce qui a vraiment compté
- Mentionnez des dates, noms et chiffres spécifiques
- Pas d'éditorialisation

Output JSON: {"summary":"<votre briefing>"}`,
    },
  };

  const prompts = langPrompts[languageCode] || langPrompts.en;

  const responseText = await withTimeout(
    chatCompletion(MODEL_SUMMARY, prompts.system, prompts.user, 2048),
    180000,
    'Weekly summary generation'
  );

  // Try standard JSON parsing first, then robust recovery for malformed JSON
  const summary = safeParseJSON<{ summary?: string }>(responseText, {}).summary
    ?? recoverSummaryFromMalformedOutput(responseText);

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
    fadedStories: fadedStories.length > 0 ? fadedStories.slice(0, 10) : undefined,
    escalatedStories: escalatedStories.length > 0 ? escalatedStories : undefined,
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
  console.log(`  Faded stories: ${fadedStories.length}`);
  console.log(`  Escalated stories: ${escalatedStories.length}`);
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
