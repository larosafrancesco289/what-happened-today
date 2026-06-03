import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline, Category, Region, Importance, Tier } from '@/types/news';
import { safeParseJSON, articleFingerprint } from '@/lib/utils';
import {
  getPrompts,
  getSystemPrompt,
  categorizePrompt,
  CATEGORIZE_SYSTEM_PROMPT,
  type SummaryStory,
} from '@/lib/prompts';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is required');
  }

  client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 90000,
    maxRetries: 0,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://what-happened-today.vercel.app',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'What Happened Today',
    },
  });

  return client;
}

// One model per pipeline role (OpenRouter format: provider/model).
// Each is overridable with a single env var; no fallback ladder — a step that
// fails retries the same model, then fails its language without taking the others down.
export const MODELS = {
  filter: process.env.OPENROUTER_MODEL_FILTER?.trim() || 'openai/gpt-oss-20b:nitro',
  headlines: process.env.OPENROUTER_MODEL_HEADLINES?.trim() || 'deepseek/deepseek-v4-flash',
  categorize: process.env.OPENROUTER_MODEL_CATEGORIZE?.trim() || 'openai/gpt-oss-20b:nitro',
  summary: process.env.OPENROUTER_MODEL_SUMMARY?.trim() || 'deepseek/deepseek-v4-flash',
} as const;

// Retained for scripts/generate-weekly.ts.
export const MODEL_SUMMARY = MODELS.summary;

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function isRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (!status) return true;
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Retry transient failures with exponential backoff.
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry non-transient provider errors such as deprecated models.
      if (attempt === maxRetries || !isRetryableError(error)) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

interface ArticleAnalysis {
  index: number;
  relevanceScore: number;
  isRelevant: boolean;
  reason: string;
}

function normalizeSummaryText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim();
}

export function sanitizeGeneratedSummary(text: string): string {
  return normalizeSummaryText(text)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n?\(Word count:\s*\d+\)\s*$/i, '')
    .replace(/\n?\(\s*\d+\s+(?:words?|parole|mots)\s*\)\s*$/i, '')
    .trim();
}

/**
 * Recover summary text from malformed model output that is close to JSON but invalid.
 * This avoids false "unavailable" days when the model returns usable prose with broken wrappers.
 */
export function recoverSummaryFromMalformedOutput(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  const valid = safeParseJSON<{ summary?: string }>(trimmed, {});
  if (valid.summary && valid.summary.trim().length > 0) {
    return sanitizeGeneratedSummary(valid.summary);
  }

  const summaryKeyMatch = trimmed.match(/"summary"\s*:\s*"([\s\S]*)$/i);
  if (summaryKeyMatch?.[1]) {
    const candidate = sanitizeGeneratedSummary(summaryKeyMatch[1].replace(/"\s*}?\s*$/, '').trim());
    if (candidate.length >= 120) return candidate;
  }

  const brokenKeyThenText = trimmed.match(/^\s*\{\s*"summary:?["']?\s*\}?\s*\n?([\s\S]+)$/i);
  if (brokenKeyThenText?.[1]) {
    const candidate = sanitizeGeneratedSummary(brokenKeyThenText[1]);
    if (candidate.length >= 120) return candidate;
  }

  if (trimmed.includes('\n')) {
    const afterFirstLine = sanitizeGeneratedSummary(trimmed.slice(trimmed.indexOf('\n') + 1))
      .replace(/^summary\s*[:\-]\s*/i, '')
      .trim();
    if (afterFirstLine.length >= 120 && !afterFirstLine.startsWith('{')) {
      return afterFirstLine;
    }
  }

  return null;
}

/**
 * Single Chat Completion call against one model.
 * When `retry` is false, the caller handles its own retry/timeout (avoids stacked retries).
 */
export async function chatCompletion(
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number,
  retry: boolean = true,
  jsonMode: boolean = true,
  temperature?: number,
): Promise<string> {
  const doCall = () => getClient().chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
    ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
  });

  const response = retry ? await withRetry(doCall) : await doCall();
  return response.choices[0]?.message?.content || '';
}

async function filterAndRankArticlesChunk(articles: ProcessedArticle[], languageCode: string): Promise<ProcessedArticle[]> {
  const prompt = getPrompts(languageCode).filterPrompt(articles);
  const threshold = 6;
  const systemPrompt = 'You are a neutral news editor. Analyze articles and respond with valid JSON only. No markdown, no explanations.';

  const responseText = await chatCompletion(MODELS.filter, systemPrompt, prompt, 4096);
  if (!responseText.trim()) {
    throw new Error(`Filtering returned an empty response from model=${MODELS.filter}`);
  }

  const parsed = safeParseJSON<{ analyses: ArticleAnalysis[] }>(responseText, { analyses: [] });
  if (!Array.isArray(parsed.analyses) || parsed.analyses.length === 0) {
    throw new Error(`Filtering returned no parseable article analyses from model=${MODELS.filter}`);
  }

  return articles
    .map((article, index) => {
      const analysis = parsed.analyses.find(r => r.index === index);
      const score = analysis?.relevanceScore ?? 0;
      return {
        ...article,
        relevanceScore: score,
        isRelevant: score >= threshold,
      };
    })
    .filter(article => article.isRelevant)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export async function filterAndRankArticles(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  // Pre-trim: limit per source and overall to keep prompts small and fast
  const MAX_PER_SOURCE = 8;
  const MAX_TOTAL = 80;
  const bySource = new Map<string, ProcessedArticle[]>();
  for (const a of articles) {
    const key = a.source || 'Unknown';
    const arr = bySource.get(key) || [];
    if (arr.length < MAX_PER_SOURCE) arr.push(a);
    bySource.set(key, arr);
  }
  const trimmed: ProcessedArticle[] = Array.from(bySource.values()).flat();
  const limited = trimmed.slice(0, MAX_TOTAL);

  // To avoid exceeding model context limits, filter in chunks then merge
  const CHUNK_SIZE = 30;
  try {
    const chunks: ProcessedArticle[][] = [];
    for (let i = 0; i < limited.length; i += CHUNK_SIZE) {
      chunks.push(limited.slice(i, i + CHUNK_SIZE));
    }

    // Process chunks in parallel for faster execution
    const chunkPromises = chunks
      .filter(chunk => chunk.length > 0)
      .map(async (chunk) => {
        try {
          return await filterAndRankArticlesChunk(chunk, languageCode);
        } catch (err) {
          console.error('Chunk filtering failed, using simple fallback for this chunk:', err);
          // Fallback: take first few from the chunk to ensure coverage
          return chunk.slice(0, 3);
        }
      });

    const chunkResults = await Promise.all(chunkPromises);

    const merged = chunkResults.flat();
    const seen = new Set<string>();
    const unique: ProcessedArticle[] = [];
    for (const a of merged) {
      const fingerprint = articleFingerprint(a);
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        unique.push(a);
      }
    }

    // Sort by score and cap
    const sorted = unique.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);

    // Guardrail: if too few items survived, add more from the first chunk to reach minimum coverage
    if (sorted.length < 5 && limited.length > 5) {
      const filler = limited
        .slice(0, 20)
        .filter(a => !sorted.some(s => s.link === a.link))
        .slice(0, 5 - sorted.length)
        .map(a => ({ ...a, relevanceScore: a.relevanceScore || 0, isRelevant: true }));
      return [...sorted, ...filler];
    }

    return sorted;
  } catch (error) {
    console.error('Error filtering articles:', error);
    return limited.slice(0, 20); // Fallback: return first 20 articles
  }
}

/** Priority ordering for tiers: lower number = higher priority. */
export const TIER_PRIORITY: Record<Tier, number> = { top: 0, also: 1, developing: 2 };

function tierPriorityOf(tier: string | undefined): number {
  return TIER_PRIORITY[(tier as Tier)] ?? TIER_PRIORITY.also;
}

/**
 * Remove duplicate stories that appear in multiple tiers, keeping the
 * higher-priority tier version (top > also > developing).
 */
function deduplicateAcrossTiers(headlines: NewsHeadline[]): NewsHeadline[] {
  const seenLinks = new Map<string, number>();
  const seenTitles = new Map<string, number>();
  const toRemove = new Set<number>();

  for (let i = 0; i < headlines.length; i++) {
    const h = headlines[i];
    const link = h.link?.toLowerCase() || '';
    const titleKey = h.title
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .toLowerCase()
      .substring(0, 40);

    const existingIdx = (link ? seenLinks.get(link) : undefined) ?? seenTitles.get(titleKey);

    if (existingIdx !== undefined) {
      const existingPriority = tierPriorityOf(headlines[existingIdx].tier);
      const currentPriority = tierPriorityOf(h.tier);
      const keepCurrent = currentPriority < existingPriority;

      toRemove.add(keepCurrent ? existingIdx : i);
      if (keepCurrent) {
        if (link) seenLinks.set(link, i);
        seenTitles.set(titleKey, i);
      }
      console.log(`Cross-tier dedup: removed duplicate "${h.title.substring(0, 50)}..." (kept ${keepCurrent ? 'current' : 'existing'} tier)`);
    } else {
      if (link) seenLinks.set(link, i);
      seenTitles.set(titleKey, i);
    }
  }

  return headlines.filter((_, i) => !toRemove.has(i));
}

interface ArticleReference {
  articleIndex?: number;
  source: string;
  title: string;
  link: string;
  publishedAt: string;
}

interface GeneratedHeadline extends NewsHeadline {
  articleIndex?: number;
  articleId?: number;
  index?: number;
}

function normalizeLinkForMatching(link: string | undefined): string {
  if (!link) return '';

  try {
    const url = new URL(link);
    return `${url.host}${url.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return link.trim().replace(/\/$/, '').toLowerCase();
  }
}

function buildArticleReferences(articles: ProcessedArticle[]): ArticleReference[] {
  return articles.flatMap((article, articleIndex) => [
    {
      articleIndex,
      source: article.source,
      title: article.title,
      link: article.link,
      publishedAt: article.publishedAt,
    },
    ...(article.coveringArticles ?? []).map(coveringArticle => ({
      source: coveringArticle.source,
      title: coveringArticle.title,
      link: coveringArticle.link,
      publishedAt: coveringArticle.publishedAt,
    })),
  ]);
}

function generatedArticleIndex(headline: GeneratedHeadline): number | undefined {
  const value = headline.articleIndex ?? headline.articleId ?? headline.index;
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function reconcileGeneratedHeadlinesWithArticles(
  headlines: GeneratedHeadline[],
  articles: ProcessedArticle[],
): NewsHeadline[] {
  const references = buildArticleReferences(articles);
  const byArticleIndex = new Map(
    references
      .filter(reference => reference.articleIndex !== undefined)
      .map(reference => [reference.articleIndex!, reference])
  );
  const byExactLink = new Map(references.map(reference => [reference.link.trim(), reference]));
  const byNormalizedLink = new Map(references.map(reference => [normalizeLinkForMatching(reference.link), reference]));

  return headlines.flatMap(headline => {
    const link = headline.link?.trim();
    const articleIndex = generatedArticleIndex(headline);
    const reference = articleIndex !== undefined
      ? byArticleIndex.get(articleIndex)
      : link
      ? byExactLink.get(link) ?? byNormalizedLink.get(normalizeLinkForMatching(link))
      : undefined;

    if (!reference) {
      console.warn(`Dropped generated headline without matching input link: ${headline.title}`);
      return [];
    }

    const cleanHeadline = { ...headline };
    delete cleanHeadline.articleIndex;
    delete cleanHeadline.articleId;
    delete cleanHeadline.index;
    const sources = Array.from(new Set(
      [reference.source, ...(headline.sources ?? []), headline.source].filter((source): source is string => Boolean(source))
    ));

    return [{
      ...cleanHeadline,
      source: reference.source,
      sources,
      link: reference.link,
      publishedAt: reference.publishedAt,
      singleSource: headline.singleSource ?? sources.length <= 1,
    }];
  });
}

export async function generateHeadlines(articles: ProcessedArticle[], languageCode: string = 'en', yesterdayHeadlines: NewsHeadline[] = []): Promise<NewsHeadline[]> {
  const prompt = getPrompts(languageCode).headlinesPrompt(articles, yesterdayHeadlines);
  const systemPrompt = getSystemPrompt(languageCode, 'headlines');
  // deepseek occasionally returns an empty/zero-headline response (not an HTTP error,
  // so withRetry doesn't catch it). Retry the same model rather than failing the language.
  const MAX_ATTEMPTS = 3;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const responseText = await chatCompletion(MODELS.headlines, systemPrompt, prompt, 4096);
      if (!responseText.trim()) {
        throw new Error(`empty response from model=${MODELS.headlines}`);
      }

      const result = safeParseJSON(responseText, { headlines: [] as GeneratedHeadline[] });
      const headlines = result.headlines || [];
      if (headlines.length === 0) {
        throw new Error(`response from model=${MODELS.headlines} contained 0 headlines`);
      }

      // Post-parse guardrail: source links, sources, and timestamps come from
      // local input articles, not from the model's copied text.
      const reconciled = reconcileGeneratedHeadlinesWithArticles(headlines, articles);
      const enriched = reconciled.map(h => {
        const sources = h.sources && h.sources.length > 0 ? h.sources : [h.source];
        return {
          ...h,
          tier: (h.tier as Tier) || 'also',
          sources,
          singleSource: h.singleSource ?? (sources.length <= 1),
        };
      });
      const deduped = deduplicateAcrossTiers(enriched);

      if (deduped.length === 0) {
        throw new Error(`response from model=${MODELS.headlines} had no source-backed headlines after reconciliation`);
      }

      return deduped;
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`generateHeadlines attempt ${attempt}/${MAX_ATTEMPTS} failed (${errorMessage(error)}), retrying...`);
      }
    }
  }

  throw new Error(`Failed to generate headlines for ${languageCode}: ${lastError?.message || 'unknown error'}`);
}

/**
 * Build a link → article-body map so the summary can be written from real source
 * text, not just headline blurbs. Covers primary and covering articles.
 */
function buildArticleBodyMap(articles: ProcessedArticle[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const article of articles) {
    map.set(normalizeLinkForMatching(article.link), article.content);
    for (const covering of article.coveringArticles ?? []) {
      if (!map.has(normalizeLinkForMatching(covering.link))) {
        map.set(normalizeLinkForMatching(covering.link), covering.content);
      }
    }
  }
  return map;
}

export async function generateDailySummary(
  headlines: NewsHeadline[],
  articles: ProcessedArticle[],
  languageCode: string = 'en',
  yesterdayHeadlines: NewsHeadline[] = [],
): Promise<string> {
  // CRITICAL: Refuse to generate summary with no headlines - this causes hallucination of old news
  if (!headlines || headlines.length === 0) {
    throw new Error('Cannot generate summary: no headlines provided. This would cause the LLM to hallucinate old/fake news.');
  }

  const MAX_BODY_CHARS = 1000;
  const bodyMap = buildArticleBodyMap(articles);
  const stories: SummaryStory[] = headlines.map(headline => {
    const body = bodyMap.get(normalizeLinkForMatching(headline.link));
    return {
      title: headline.title,
      summary: headline.summary,
      body: body ? body.substring(0, MAX_BODY_CHARS) : undefined,
    };
  });

  const prompt = getPrompts(languageCode).summaryPrompt(stories, yesterdayHeadlines);
  const systemPrompt = getSystemPrompt(languageCode, 'summary');
  // Low temperature keeps length and quality consistent run-to-run; the model
  // otherwise swings wildly (60–310 words) at its default temperature.
  const SUMMARY_TEMPERATURE = 0.5;
  // ~220 words. Below this a run is treated as too short and retried — but a short
  // briefing is still returned rather than failing the language outright.
  const MIN_TARGET_CHARS = 1400;
  const MAX_ATTEMPTS = 2;
  let lastError: Error | undefined;
  let best = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const apiStart = Date.now();
      const responseText = await chatCompletion(MODELS.summary, systemPrompt, prompt, 2048, false, true, SUMMARY_TEMPERATURE);
      console.log(`generateDailySummary: model=${MODELS.summary} API response time ${Date.now() - apiStart} ms (attempt ${attempt}/${MAX_ATTEMPTS})`);

      const result = safeParseJSON<{ summary?: string }>(responseText, {});
      const candidate = result.summary
        ? sanitizeGeneratedSummary(result.summary)
        : (recoverSummaryFromMalformedOutput(responseText) ?? '');

      if (!candidate) {
        throw new Error(`Summary generation returned empty/malformed result. Raw response: ${responseText.substring(0, 300)}`);
      }

      if (candidate.length > best.length) best = candidate;
      if (candidate.length >= MIN_TARGET_CHARS) return candidate;

      console.warn(`Summary short (${candidate.length} chars < ${MIN_TARGET_CHARS}), retrying for a fuller briefing...`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`Summary generation failed on model=${MODELS.summary} attempt ${attempt}, retrying...`);
      }
    }
  }

  // Prefer a short-but-valid briefing over failing the whole language.
  if (best) {
    console.warn(`Using best available summary (${best.length} chars) after ${MAX_ATTEMPTS} attempts`);
    return best;
  }

  console.error('Error generating summary:', lastError);
  throw new Error(`Failed to generate summary for ${languageCode}: ${lastError?.message || 'unknown error'}`);
}

// Categorization interface for AI response
interface HeadlineCategorization {
  index: number;
  category: Category;
  region: Region;
  importance: Importance;
}

/**
 * Categorize headlines by topic, region, and importance.
 * Adds metadata for frontend filtering and visual hierarchy. Non-critical: on
 * failure it returns sensible defaults rather than failing the whole edition.
 */
export async function categorizeHeadlines(headlines: NewsHeadline[]): Promise<NewsHeadline[]> {
  if (headlines.length === 0) return headlines;

  const defaultMeta = {
    category: 'politics' as Category,
    region: 'global' as Region,
    importance: 'notable' as Importance,
  };

  try {
    const responseText = await chatCompletion(MODELS.categorize, CATEGORIZE_SYSTEM_PROMPT, categorizePrompt(headlines), 2048);
    const parsed = safeParseJSON<{ categories: HeadlineCategorization[] }>(responseText, { categories: [] });
    if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) {
      throw new Error(`Categorization returned no parseable categories from model=${MODELS.categorize}`);
    }

    return headlines.map((headline, index) => {
      const match = parsed.categories.find(c => c.index === index);
      return {
        ...headline,
        category: match?.category ?? defaultMeta.category,
        region: match?.region ?? defaultMeta.region,
        importance: match?.importance ?? defaultMeta.importance,
      };
    });
  } catch (error) {
    console.error('Error categorizing headlines:', errorMessage(error));
    return headlines.map(headline => ({ ...headline, ...defaultMeta }));
  }
}
