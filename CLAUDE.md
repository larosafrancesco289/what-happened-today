# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### News Generation Pipeline
- `npm run generate-news` - Generate news for default language (English)
- `npm run generate-news:en` - Generate English news
- `npm run generate-news:it` - Generate Italian news
- `npm run generate-news:fr` - Generate French news
- `npm run generate-news:all` - Generate news for all languages

### Testing the Pipeline
- `curl http://localhost:3000/api/test-pipeline` - Test with mock data (no API calls)
- `curl http://localhost:3000/api/cron` - Test full pipeline (requires OpenAI API key)

## Architecture Overview

### Core Pipeline Flow
1. **RSS Ingestion** (`src/lib/news-fetcher.ts`) - Fetches from curated RSS feeds per language
2. **AI Filtering** (`src/lib/openai.ts`) - GPT-4.1-nano filters and ranks articles for relevance
3. **Headlines Generation** (`src/lib/openai.ts`) - Creates neutral, factual headlines
4. **Summary Generation** (`src/lib/openai.ts`) - Produces coherent daily summaries
5. **Data Storage** (`src/lib/utils.ts`) - Saves to `/data/{lang}/YYYY-MM-DD.json`

### Key Components
- **Multi-language Support**: English, Italian, and French with separate RSS feeds and prompts
- **AI Processing**: Three-stage OpenAI pipeline with structured output and retry logic
- **Data Structure**: Language-organized JSON files with date-based routing
- **Automation**: GitHub Actions triggers daily at 6 AM UTC

### File Organization
- `/src/app/api/cron/route.ts` - Production news pipeline endpoint
- `/src/app/api/news/route.ts` - News data API with language support
- `/src/lib/languages.ts` - Language configs and RSS feed definitions
- `/src/lib/openai.ts` - AI processing with language-specific prompts
- `/src/contexts/LanguageContext.tsx` - Client-side language state management
- `/scripts/generate-daily-news.ts` - Standalone pipeline script

## Environment Variables
- `OPENAI_API_KEY` - Required for AI processing
- `VERCEL_DEPLOY_HOOK` - Optional webhook for deployment triggers

## Development Notes

### RSS Feed Management
RSS feeds are defined in `src/lib/languages.ts` with descriptions of each source's editorial focus. When adding new languages:
1. Add language config to `SUPPORTED_LANGUAGES`
2. Add RSS feeds to `RSS_FEEDS_BY_LANGUAGE`
3. Add translations to `src/lib/i18n.ts`
4. Add language-specific prompts to `src/lib/openai.ts`

### AI Processing
The pipeline uses GPT-4.1-nano for filtering/headlines and GPT-4.1 for summaries. All AI calls use structured output with JSON schemas and include retry logic with exponential backoff.

### Data Flow
- RSS feeds → Raw articles → Deduplication → AI filtering → Headlines → Summary → JSON file
- Each language processes independently with its own RSS sources and prompts
- Files saved to `/data/{lang}/YYYY-MM-DD.json` structure (en, it, fr)

### Testing
Use mock data endpoint (`/api/test-pipeline`) to test without consuming OpenAI credits. The full pipeline (`/api/cron`) processes real RSS feeds and generates actual news summaries.