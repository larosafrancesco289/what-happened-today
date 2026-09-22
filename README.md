# What Happened Today

The day's most important news in five minutes, without the noise. One short briefing and 6–8 stories each morning, in English, Italian and French, with every story linked to the outlets that reported it.

Live at [what-happened-today.vercel.app](https://what-happened-today.vercel.app).

## How it works

Every morning a GitHub Action runs one job per language:

1. **Fetch**: pull the last 30 hours from each language's RSS feeds (`src/pipeline/feeds.ts`).
2. **Cluster**: group articles about the same story across outlets by shared title keywords. Stories covered by more outlets rank higher. No model involved.
3. **Write**: one call to `openai/gpt-6-luna` via OpenRouter with a strict JSON schema. The model picks candidates by number and writes the briefing and story summaries. Links, outlets and dates are attached from the feed data, never from model output. If the call fails or the output doesn't validate, it falls back to `deepseek/deepseek-v4-flash-0731`.
4. **Publish**: successful editions are committed to `data/{lang}/YYYY-MM-DD.json` in one commit, and the site is rebuilt.

A language that fails turns the run red; the others still publish. Each edition costs about $0.001.

The site is a fully static Next.js build: every edition is a pre-rendered page at `/{lang}/{date}`, and `/{lang}` shows the latest one.

## Development

```bash
bun install
echo "OPENROUTER_API_KEY=..." > .env.local

bun run edition en   # generate today's English edition
bun run dev          # http://localhost:3000
bun test && bun run lint && bun run build
```

`MODELS=provider/model,...` overrides the model chain for a run.
