import { STRINGS, type Lang } from '../languages';
import type { Story } from '../editions';
import type { Candidate } from './cluster';

// Tried in order until one returns a valid edition. MODELS=a,b in the environment overrides the chain.
const DEFAULT_MODELS = ['openai/gpt-6-luna', 'deepseek/deepseek-v4-flash-0731'];
const MODELS = process.env.MODELS?.split(',') ?? DEFAULT_MODELS;

// Low reasoning made Luna's editions more faithful in blind judging (2026-09-22) for ~3s and
// ~20% more tokens. Other models run with reasoning off: DeepSeek's default is slow and costly.
const REASONING: Record<string, string> = { 'openai/gpt-6-luna': 'low' };

// OpenAI's small models reject a temperature parameter.
const NO_TEMPERATURE = new Set(['openai/gpt-6-luna']);

interface ModelOutput {
  summary: string;
  stories: { candidates: number[]; title: string; summary: string }[];
}

const SCHEMA = {
  name: 'edition',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['stories', 'summary'],
    properties: {
      stories: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidates', 'title', 'summary'],
          properties: {
            candidates: { type: 'array', items: { type: 'integer' } },
            title: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      },
      summary: { type: 'string' },
    },
  },
};

function buildPrompt(lang: Lang, candidates: Candidate[]): string {
  const language = STRINGS[lang].name;
  const list = candidates.map((candidate, i) => {
    const outlets = [...new Set(candidate.map(a => a.source))];
    const lines = candidate.slice(0, 3).map(a => `- ${a.source}: ${a.title}${a.excerpt ? ` — ${a.excerpt}` : ''}`);
    return `[${i + 1}] Covered by: ${outlets.join(', ')}\n${lines.join('\n')}`;
  });

  return `You are the editor of a calm daily news briefing. Readers want the day's most important news in five minutes, told plainly.

Below are ${candidates.length} candidate stories from the last 30 hours of news feeds, each with the outlets that covered it and up to three headlines with excerpts. Coverage by many outlets usually signals importance, but use judgment: prefer news with real consequences for many people over celebrity, sport, crime briefs and lifestyle pieces, unless they are genuinely major.

Write today's edition in ${language}.

"stories": the 6 to 8 most important distinct stories, most important first.
- "candidates": the candidate numbers the story is based on, most informative first. Merge candidates about the same event.
- "title": a factual headline, at most 12 words, in sentence case. No questions or teaser colons.
- "summary": two sentences, at most 45 words. First what happened; then the most useful concrete detail from the sources: a number, a cause, a reaction, or the next scheduled step.

"summary": the briefing. Three paragraphs, 180 to 260 words, covering the top stories in order of importance. Give each paragraph one or two stories and tell them properly. Stories that don't fit stay in the list; don't string them together with "separately" or "meanwhile". Plain prose, paragraphs separated by blank lines, no markdown.

Rules:
- Every statement must come from the candidates: no outside facts, background or interpretation.
- No commentary. Never close a sentence or paragraph with lines like "the outlook remains uncertain", "this raises questions about", "amid growing tensions" or "marking a significant step".
- Write as the newspaper, never about your material: no "reports say", "according to the articles" or "no further details were given".
- If sources contradict each other, say so in a few words rather than blending them.
- Neutral tone: no emotive adjectives; attribute claims to whoever made them.
- Write natural, idiomatic ${language}, never translated-sounding, even where excerpts are in another language.

CANDIDATES

${list.join('\n\n')}`;
}

async function complete(model: string, prompt: string): Promise<ModelOutput> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://what-happened-today.vercel.app',
      'X-Title': 'What Happened Today',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      // Always cap output: without it OpenRouter budgets for the model's full output window.
      max_tokens: 4000,
      ...(NO_TEMPERATURE.has(model) ? {} : { temperature: 0.3 }),
      reasoning: { effort: REASONING[model] ?? 'none' },
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      provider: { require_parameters: true },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);

  const body = await response.json();
  const { prompt_tokens, completion_tokens, cost } = body.usage ?? {};
  console.log(`  ${model}: ${prompt_tokens} in, ${completion_tokens} out, $${cost ?? '?'}`);
  return JSON.parse(body.choices?.[0]?.message?.content ?? '');
}

/** Check the model's output and attach links, outlets and dates from our own data. */
function toStories(output: ModelOutput, candidates: Candidate[]): Story[] {
  const words = output.summary.split(/\s+/).length;
  if (words < 140 || words > 340) throw new Error(`briefing is ${words} words`);
  if (output.stories.length < 5 || output.stories.length > 9) {
    throw new Error(`${output.stories.length} stories`);
  }

  return output.stories.map(story => {
    const articles = story.candidates.flatMap(n => {
      const candidate = candidates[n - 1];
      if (!candidate) throw new Error(`story "${story.title}" cites unknown candidate ${n}`);
      return candidate;
    });
    const [lead, ...rest] = articles;
    const coverage = rest.filter((a, i) =>
      a.source !== lead.source && rest.findIndex(b => b.source === a.source) === i);

    return {
      title: story.title.trim(),
      summary: story.summary.trim(),
      link: lead.link,
      source: lead.source,
      publishedAt: lead.publishedAt,
      coverage: coverage.map(a => ({ source: a.source, link: a.link })),
    };
  });
}

export async function writeStories(lang: Lang, candidates: Candidate[]) {
  const prompt = buildPrompt(lang, candidates);
  const failures: string[] = [];

  for (const model of MODELS) {
    try {
      const output = await complete(model, prompt);
      return { model, summary: output.summary.trim(), headlines: toStories(output, candidates) };
    } catch (error) {
      const message = `${model}: ${error instanceof Error ? error.message : error}`;
      console.warn(`  ✗ ${message}`);
      failures.push(message);
    }
  }

  throw new Error(`All models failed:\n${failures.join('\n')}`);
}
