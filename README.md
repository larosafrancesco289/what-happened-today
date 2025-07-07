# What Happened Today

A clean, AI-generated daily summary of global news — free from clickbait, emotion, and information overload.

**Now Available in Multiple Languages** | **Dark Mode Support** | **Mobile-First Design**

Visit the live site: **[what-happened-today.vercel.app](https://what-happened-today.vercel.app)**

## Features

- **Multilingual Support**: Currently available in English, Italian, and French with language-specific news sources
- **Clean Daily Summaries**: Two-paragraph AI-generated summaries of global events
- **Ranked Headlines**: Top 5-10 stories with neutral, factual summaries  
- **Dark/Light Theme**: Toggle between themes for comfortable reading
- **Mobile-First Design**: Responsive UI built with Tailwind CSS
- **Date Navigation**: Browse previous days' summaries with intuitive controls
- **Automated Pipeline**: RSS feed ingestion and AI processing for all languages
- **Global Coverage**: Carefully curated international news sources per language
- **Minimal & Fast**: Clean design focused on readability and performance

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS v4
- **AI Processing**: OpenAI GPT-4.1-mini with structured output
- **Internationalization**: Custom i18n system with context-based translations
- **Analytics**: Vercel Analytics for user insights
- **Hosting**: Vercel with GitHub Actions automation
- **Data Storage**: Language-organized JSON files (`/data/{lang}/YYYY-MM-DD.json`)
- **Icons**: Heroicons
- **Styling**: Tailwind CSS with Inter font

## Quick Start

1. **Clone and install**:
   ```bash
   git clone https://github.com/larosafrancesco289/what-happened-today
   cd what-happened-today
   npm install
   ```

2. **Set up environment variables** (create `.env.local`):
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**: [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/           # Production news pipeline
│   │   ├── news/           # News data API endpoints
│   │   └── test-pipeline/  # Development testing
│   ├── [date]/             # Dynamic route for specific dates
│   ├── layout.tsx          # Root layout with metadata & analytics
│   ├── page.tsx            # Home page (today's summary)
│   └── globals.css         # Global styles and theme variables
├── components/
│   ├── AppHeader.tsx       # Header with language/theme controls
│   ├── DateNavigation.tsx  # Navigation between dates
│   ├── LanguageSelector.tsx # Language switching component
│   ├── LoadingSpinner.tsx  # Loading component
│   ├── NewsSummary.tsx     # Main content display
│   ├── ThemeProvider.tsx   # Theme context provider
│   └── ThemeToggle.tsx     # Dark/light mode toggle
├── contexts/
│   └── LanguageContext.tsx # Language context and state management
├── lib/
│   ├── client-utils.ts     # Client-side utility functions
│   ├── i18n.ts             # Internationalization translations
│   ├── languages.ts        # Language configuration and RSS feeds
│   ├── news-fetcher.ts     # RSS feed fetching logic
│   ├── openai.ts           # AI processing functions
│   ├── rss-feeds.ts        # RSS feed definitions
│   └── utils.ts            # Server-side utility functions
└── types/
    └── news.ts             # TypeScript interfaces

data/
├── en/
│   └── YYYY-MM-DD.json    # English daily summary files
├── it/
│   └── YYYY-MM-DD.json    # Italian daily summary files
└── fr/
    └── YYYY-MM-DD.json    # French daily summary files

scripts/
└── generate-daily-news.ts # Standalone news generation script
```

## Supported Languages

### English
- **Sources**: 10 diverse global news outlets
- **Focus**: International coverage with minimal bias
- **RSS Feeds**: Reuters, AP, BBC, Al Jazeera, Deutsche Welle, Guardian, France 24, NPR, AllAfrica, VOA

### Italian
- **Sources**: 8 major Italian news outlets
- **Focus**: Italian and international news
- **RSS Feeds**: ANSA, Rai News, TGCOM24, Corriere, Repubblica, Il Post, Internazionale, Il Sole 24 Ore

### French
- **Sources**: 8 major French news outlets
- **Focus**: French and international news with francophone perspective
- **RSS Feeds**: Le Monde, Le Figaro, France Info, Libération, Les Échos, L'Express, France 24, RFI

## API Endpoints

### `/api/cron` - Production Pipeline
- Fetches RSS feeds for all supported languages
- Uses GPT-4.1-mini to filter, rank, and summarize articles
- Generates daily JSON files with neutral, factual content
- Runs automatically via GitHub Actions at 6 AM UTC

### `/api/news/[date]` - News Data API
- Serves daily news data for specific dates
- Supports language parameter: `?lang=en` or `?lang=it`
- Returns structured JSON with summary and headlines

### `/api/test-pipeline` - Development Testing
- Uses mock data to test the pipeline
- Generates sample daily JSON file
- Safe to run without API credits

## Testing the Pipeline

1. **Test with mock data** (no API calls required):
   ```bash
   curl http://localhost:3000/api/test-pipeline
   ```

2. **Test full pipeline for English** (requires OpenAI API key):
   ```bash
   curl http://localhost:3000/api/cron
   ```

3. **Generate news manually**:
   ```bash
   # English news
   npm run generate-news:en
   
   # Italian news  
   npm run generate-news:it
   
   # French news
   npm run generate-news:fr
   
   # All languages
   npm run generate-news:all
   ```

## Data Format

Each daily summary follows this JSON structure:

```json
{
  "date": "2025-01-11",
  "summary": "Two-paragraph AI-generated summary of the day's most significant global events...",
  "headlines": [
    {
      "title": "Factual headline without sensationalism",
      "source": "Source Name", 
      "summary": "Brief, neutral summary of the story",
      "link": "https://source-url.com/article"
    }
  ]
}
```

## Deployment

### Vercel (Recommended)

1. **Deploy to Vercel**:
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/larosafrancesco289/what-happened-today)

2. **Set environment variables** in Vercel dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key

3. **GitHub Actions automation** will run daily at 6 AM UTC for all languages

### Environment Variables

For production deployment, ensure these environment variables are set:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

Optional Vercel webhook for triggering deployments after news generation:
```bash
VERCEL_DEPLOY_HOOK=your_vercel_deploy_hook_url
```

## Routes

- `/` - Today's summary (auto-detects browser language)
- `/YYYY-MM-DD` - Specific date's summary (e.g., `/2025-01-11`)
- Language-aware routing with browser detection
- Custom 404 page for missing dates

## Development Scripts

```bash
npm run dev                # Start development server with Turbopack
npm run build              # Build for production  
npm run start              # Start production server
npm run lint               # Run ESLint
npm run generate-news      # Generate news for default language (English)
npm run generate-news:en   # Generate English news
npm run generate-news:it   # Generate Italian news
npm run generate-news:fr   # Generate French news
npm run generate-news:all  # Generate news for all languages
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test locally
4. Test the news pipeline: `npm run generate-news:en`
5. Commit with clear messages: `git commit -m "Add feature description"`
6. Push and create a Pull Request

### Adding New Languages

To add support for a new language:

1. Add language config to `src/lib/languages.ts`
2. Add RSS feeds for the new language
3. Add translations to `src/lib/i18n.ts`
4. Update the generation scripts in `package.json`
5. Test the pipeline with the new language

## License

MIT License - see [LICENSE](LICENSE) file for details

---

Built by [Francesco La Rosa](https://github.com/larosafrancesco289)

**Live Demo**: [what-happened-today.vercel.app](https://what-happened-today.vercel.app)
