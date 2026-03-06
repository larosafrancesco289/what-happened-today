### What Happened Today

A daily, AI-generated summary of global news that prioritizes clarity, neutrality, and fast comprehension.

Visit the site: [what-happened-today.vercel.app](https://what-happened-today.vercel.app)

### Why

To provide a concise, factual snapshot of the day without sensationalism, helping readers stay informed with minimal time and noise.

### Features

- **Multilingual**: English, Italian, French
- **Daily summary**: Two linked paragraphs synthesizing key developments
- **Ranked headlines**: 5 to 10 neutral, source linked items
- **Theme**: Light and dark modes
- **Date navigation**: Browse previous days
- **Automated pipeline**: RSS ingestion, AI filtering, headline and summary generation

### Setup

1) Clone and install

```bash
git clone https://github.com/larosafrancesco289/what-happened-today
cd what-happened-today
bun install
```

2) Configure environment

Create `.env.local` in the project root:

```bash
# Required
OPENROUTER_API_KEY=your_openrouter_api_key

# Required in production to protect /api/cron
CRON_SECRET=replace-me-with-a-long-random-string

# Optional OpenRouter analytics headers
OPENROUTER_SITE_URL=https://what-happened-today.vercel.app
OPENROUTER_SITE_NAME=What Happened Today
```

Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys)

Model configuration lives in `src/lib/llm-client.ts`.

### Quickstart

```bash
bun run dev           # start the app at http://localhost:3000
bun run build         # build for production
bun run start         # run the production build
bun run lint          # run ESLint
bun run test          # run regression tests
bun run check         # lint + test + production build
```

Pipeline commands:

```bash
bun run generate-news:en    # generate English news
bun run generate-news:it    # generate Italian news
bun run generate-news:fr    # generate French news
bun run generate-news:all   # generate all languages
bun run generate-weekly:en  # generate English weekly digest
bun run generate-weekly:all # generate all weekly digests
```

### Usage

- Browse `http://localhost:3000` for today's summary
- Open `/YYYY-MM-DD` for a specific date (for example `/2025-01-11`)
- Programmatic access: `/api/news?date=YYYY-MM-DD&language=en|it|fr`
- Weekly digest API: `/api/weekly?weekId=YYYY-WXX&language=en|it|fr`
- Health check: `/api/health`
- Protected pipeline trigger: `/api/cron?language=en|it|fr|all` with `Authorization: Bearer $CRON_SECRET`

### Architecture

Code tree:

```
src/
├── app/
│   ├── api/
│   │   ├── cron/            # protected production pipeline endpoint
│   │   ├── health/          # lightweight runtime health check
│   │   ├── news/            # data API (by date and language)
│   │   ├── weekly/          # weekly digest API
│   │   └── test-pipeline/   # mock pipeline for local testing
│   ├── [date]/              # dynamic route for specific dates
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx             # today view
├── components/
│   ├── AppHeader.tsx
│   ├── DailyNewsPageContent.tsx
│   ├── DateNavigation.tsx
│   ├── LanguageSelector.tsx
│   ├── LoadingSpinner.tsx
│   ├── NewsSummary.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
├── contexts/
│   └── LanguageContext.tsx
├── hooks/
│   └── use-daily-news.ts
├── lib/
│   ├── client-utils.ts
│   ├── cron-auth.ts
│   ├── date-utils.ts
│   ├── i18n.ts
│   ├── languages.ts         # RSS feeds per language
│   ├── llm-client.ts        # OpenRouter API integration
│   ├── news-fetcher.ts
│   ├── pipeline/
│   │   └── daily.ts         # shared daily generation workflow
│   └── utils.ts
└── types/
    └── news.ts

data/
├── en/  # YYYY-MM-DD.json
├── it/  # YYYY-MM-DD.json
└── fr/  # YYYY-MM-DD.json

scripts/
├── generate-news.ts
└── generate-weekly.ts
```

Notes:

- The daily pipeline reads curated RSS feeds per language, filters and ranks with OpenRouter, generates headlines, and synthesizes a two- to three-paragraph summary. Output is saved under `data/{lang}/YYYY-MM-DD.json`.
- `/api/cron` now uses the same shared pipeline module as the CLI script, so scheduled runs and manual runs stay in sync.
- Date handling is timezone-safe for both the UI and the pipeline, which avoids day-shift bugs for readers outside UTC.
- The UI loads the file for today or for the selected date.
- Uses Bun for fast TypeScript execution and package management.
- Deployed on Vercel with daily GitHub Actions automation.

### License

MIT. See `LICENSE`.
