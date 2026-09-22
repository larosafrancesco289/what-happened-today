import { STRINGS, type Lang } from '../languages';
import type { Story } from '../editions';
import type { Candidate } from './cluster';

// Tried in order until one returns a valid edition. Reasoning is off for all of them:
// this is a writing task, and reasoning made runs slow and unpredictable in cost.
// MODELS=a,b in the environment overrides the chain.
const DEFAULT_MODELS = ['openai/gpt-6-luna', 'deepseek/deepseek-v4-flash-0731'];
const MODELS = process.env.MODELS?.split(',') ?? DEFAULT_MODELS;

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

  return `You are the editor of a calm daily news briefing. Readers want to understand the day's most important news in five minutes, without sensationalism.

Below are ${candidates.length} candidate stories from the last 30 hours of news feeds. Each has a number, the outlets that covered it, and a headline with an excerpt from up to three of them. Stories covered by more outlets are usually more significant, but use judgment: prefer news with real consequences for many people over celebrity, sport, crime briefs and lifestyle pieces, unless they are genuinely major.

Write today's edition in ${language}:

"stories": the 6 to 8 most important distinct stories, most important first. For each:
- "candidates": the candidate numbers it is based on, most informative first. Merge candidates that describe the same event.
- "title": a plain, factual headline of at most 12 words, in sentence case. No clickbait, no questions, no teaser colons.
- "summary": two sentences, at most 45 words: what happened, then why it matters or what happens next.

"summary": the daily briefing. Three short paragraphs, 180 to 260 words in total, covering the most important stories in order. Plain prose separated by blank lines: no lists, headings or markdown. Briefly give any context a reader needs to follow.

Rules:
- Use only facts found in the candidates. Never add numbers, names or claims that are not there.
- Neutral tone: no emotional adjectives, no speculation; attribute claims to whoever made them.
- Write natural ${language}, even where an excerpt is in another language.

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
      reasoning: { effort: 'none' },
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
