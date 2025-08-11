### What Happened Today

A daily, AI generated summary of global news that prioritizes clarity and neutrality.

Visit the site: `https://what-happened-today.vercel.app`

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
npm install
```

2) Configure environment

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key
```

### Quickstart

```bash
npm run dev           # start the app at http://localhost:3000
npm run build         # build for production
npm run start         # run the production build
npm run lint          # run ESLint
```

Pipeline commands:

```bash
npm run generate-news:en    # generate English news
npm run generate-news:it    # generate Italian news
npm run generate-news:fr    # generate French news
npm run generate-news:all   # generate all languages
```

### Usage

- Browse `http://localhost:3000` for today’s summary
- Open `/YYYY-MM-DD` for a specific date (for example `/2025-01-11`)
- Programmatic access: `/api/news?date=YYYY-MM-DD&language=en|it|fr`

### Architecture

Code tree:

```
src/
├── app/
│   ├── api/
│   │   ├── cron/            # production pipeline endpoint
│   │   ├── news/            # data API (by date and language)
│   │   └── test-pipeline/   # mock pipeline for local testing
│   ├── [date]/              # dynamic route for specific dates
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx             # today view
├── components/
│   ├── AppHeader.tsx
│   ├── DateNavigation.tsx
│   ├── LanguageSelector.tsx
│   ├── LoadingSpinner.tsx
│   ├── NewsSummary.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
├── contexts/
│   └── LanguageContext.tsx
├── lib/
│   ├── client-utils.ts
│   ├── i18n.ts
│   ├── languages.ts
│   ├── news-fetcher.ts
│   ├── openai.ts
│   ├── rss-feeds.ts
│   └── utils.ts
└── types/
    └── news.ts

data/
├── en/  # YYYY-MM-DD.json
├── it/  # YYYY-MM-DD.json
└── fr/  # YYYY-MM-DD.json

scripts/
└── generate-news.ts
```

Notes:

- The pipeline reads curated RSS feeds per language, filters and ranks with the OpenAI API, generates headlines, and synthesizes a two paragraph summary. Output is saved as JSON under `data/{lang}/YYYY-MM-DD.json`.
- The UI loads the file for today or for the selected date.

### License

MIT. See `LICENSE`.
