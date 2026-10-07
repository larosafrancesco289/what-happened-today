import { STRINGS, type Lang } from '../languages';
import type { Story } from '../editions';
import type { Candidate } from './cluster';

// Tried in order until one returns a valid edition. MODELS=a,b in the environment overrides the chain.
const DEFAULT_MODELS = ['anthropic/claude-haiku-5.5', 'openai/gpt-6-luna', 'deepseek/deepseek-v4-flash-0731'];
const MODELS = process.env.MODELS?.split(',') ?? DEFAULT_MODELS;

// Medium effort won blind judging on 2026-10-07: Haiku 5.5 beat Luna overall (Luna held up in
// Italian), and Luna medium beat Luna low. Haiku at high effort thought past 16k tokens
// without writing anything. Other models run with reasoning off: DeepSeek's default is slow and costly.
const REASONING: Record<string, string> = {
  'anthropic/claude-haiku-5.5': 'medium',
  'openai/gpt-6-luna': 'medium',
};

// These models reject a custom temperature.
const NO_TEMPERATURE = new Set(['anthropic/claude-haiku-5.5', 'openai/gpt-6-luna']);

type Message = { role: 'system' | 'user'; content: string };

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

const escapeXml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * Written the way Anthropic's prompting guide recommends: role in the system prompt, data in XML
 * tags first and instructions last, a reason given for each rule. In blind judging (2026-10-07) it
 * beat a plain bulleted prompt on both Haiku 5.5 and Luna.
 */
function buildPrompt(lang: Lang, candidates: Candidate[]): Message[] {
  const language = STRINGS[lang].name;
  // No outlet names: given them, models wrote "according to the BBC" despite the rules (2026-10-07).
  const list = candidates.map((candidate, i) => {
    const outlets = new Set(candidate.map(a => a.source)).size;
    const items = candidate.slice(0, 3).map(a =>
      `<item><headline>${escapeXml(a.title)}</headline>${a.excerpt ? `<excerpt>${escapeXml(a.excerpt)}</excerpt>` : ''}</item>`);
    return `<candidate index="${i + 1}" outlets="${outlets}">\n${items.join('\n')}\n</candidate>`;
  });

  const system = `You are the editor of a calm daily news briefing published in ${language}. Readers come to it to learn the day's most important news in five minutes, told plainly and accurately. They trust it because every sentence can be traced to the reporting it is based on.`;

  const user = `<candidates>
${list.join('\n')}
</candidates>

The candidates above are the stories from the last 30 hours of news feeds, grouped by event. Each shows how many outlets covered it and up to three headlines with excerpts. An excerpt ending in "…" was cut off by the feed.

Write today's edition in ${language} as JSON with two fields.

"stories" holds the 6 to 8 most important distinct stories, most important first. Wide coverage usually signals importance, but weigh consequences too: news that affects many people's lives, safety or money comes before celebrity, sport, crime briefs and lifestyle pieces, unless those are genuinely major. For each story, "candidates" lists the candidate numbers it draws on, most informative first; merge candidates only when they report the same event, because the site links each story to the sources it cites. "title" is a factual headline of at most 12 words in sentence case, written as a plain statement rather than a question or a teaser with a colon. "summary" is two sentences, at most 45 words: first what happened, then the most useful concrete detail the sources give, such as a number, a cause, a reaction or the next scheduled step.

"summary" is the briefing: three paragraphs of plain prose, 180 to 260 words in total, separated by blank lines, telling only the three to five most important stories in order. Give each paragraph one or two stories and tell them properly. Readers who want more will scroll to the story list, so the remaining stories belong there rather than chained on with "separately" or "meanwhile".

Use only what the candidates say. Readers rely on every statement being traceable to its sources, so leave out background, context or interpretation you know from elsewhere. When an excerpt is cut off with "…", use only the words that are there rather than guessing how it continues.

Write as the newspaper itself: state facts directly and attribute claims to the people or institutions who made them. Readers never see the candidate list, so phrases about your material such as "reports say", "according to one source" or "no further details were given" would only confuse them.

When figures or facts conflict between candidates, give both ("turnout was 61%, or 58% by another count") so readers see the disagreement; a range or a single figure would hide it.

End sentences and paragraphs on facts. Closing lines like "the outlook remains uncertain", "this raises questions about", "amid growing tensions" or "marking a significant step" add no information and read as commentary. Describe events in plain words rather than emotive adjectives.

Write natural, idiomatic ${language}, the way a native journalist would, even where excerpts are in another language.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function complete(model: string, messages: Message[]): Promise<ModelOutput> {
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
      messages,
      // Always cap output: without it OpenRouter budgets for the model's full output window.
      // Thinking counts toward the cap: Haiku at medium effort has used up to ~15k tokens.
      max_tokens: 32_000,
      ...(NO_TEMPERATURE.has(model) ? {} : { temperature: 0.3 }),
      reasoning: { effort: REASONING[model] ?? 'none' },
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      provider: { require_parameters: true },
    }),
    signal: AbortSignal.timeout(240_000),
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
