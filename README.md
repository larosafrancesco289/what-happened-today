# What Happened Today

A clean, AI-generated daily summary of global news — free from clickbait, emotion, and information overload.

## Features

- **Clean Daily Summaries**: Two-paragraph AI-generated summaries of global events
- **Ranked Headlines**: Top 5-10 stories with neutral, factual summaries  
- **Mobile-First Design**: Responsive UI built with Tailwind CSS
- **Date Navigation**: Browse previous days' summaries
- **Automated Pipeline**: RSS feed ingestion and AI processing
- **Global Coverage**: 10 diverse international news sources
- **Minimal & Fast**: Clean design focused on readability

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **AI Processing**: OpenAI GPT-4.1-mini with structured output
- **Analytics**: Vercel Analytics for user insights
- **Hosting**: Vercel with GitHub Actions automation
- **Data Storage**: JSON files per day (`/data/YYYY-MM-DD.json`)
- **Icons**: Heroicons
- **Styling**: Tailwind CSS with Inter font

## Quick Start

1. **Clone and install**:
   ```bash
   git clone https://github.com/your-username/what-happened-today
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
│   │   └── test-pipeline/  # Development testing
│   ├── [date]/             # Dynamic route for specific dates
│   ├── layout.tsx          # Root layout with metadata & analytics
│   └── page.tsx            # Home page (today's summary)
├── components/
│   ├── DateNavigation.tsx  # Navigation between dates
│   ├── LoadingSpinner.tsx  # Loading component
│   ├── NewsSummary.tsx     # Main content display
│   └── ThemeProvider.tsx   # Theme context provider
├── lib/
│   └── utils.ts            # Utility functions for dates/data
└── types/
    └── news.ts             # TypeScript interfaces

data/
└── YYYY-MM-DD.json        # Daily summary files
```

## API Endpoints

### `/api/cron` - Production Pipeline
- Fetches RSS feeds from 10 diverse global news sources
- Uses GPT-4.1-mini to filter, rank, and summarize articles
- Generates daily JSON file with neutral, factual content
- Runs automatically via GitHub Actions at 6 AM UTC

### `/api/test-pipeline` - Development Testing
- Uses mock data to test the pipeline
- Generates sample daily JSON file
- Safe to run without API credits

## Testing the Pipeline

1. **Test with mock data** (no API calls required):
   ```bash
   curl http://localhost:3000/api/test-pipeline
   ```

2. **Test full pipeline** (requires OpenAI API key):
   ```bash
   curl http://localhost:3000/api/cron
   ```

## News Sources

The pipeline aggregates from 10 carefully selected global sources for comprehensive, unbiased coverage:

- **Reuters** - Fast, factual wire service with minimal clickbait
- **Associated Press** - Broad geographic coverage and breaking news
- **BBC World** - International perspective on politics, science, and crises
- **Al Jazeera English** - Non-Western framing and Global South perspective
- **Deutsche Welle** - European public broadcaster with Africa focus
- **The Guardian** - Progressive journalism with environmental coverage
- **France 24** - French international perspective in English
- **NPR News** - US public radio with balanced world reporting
- **AllAfrica** - Pan-African perspective from 100+ African outlets
- **Voice of America** - US-funded international news service

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
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/what-happened-today)

2. **Set environment variables** in Vercel dashboard:
   - `OPENAI_API_KEY`: Your OpenAI API key

3. **GitHub Actions automation** will run daily at 6 AM UTC (configured in `.github/workflows/daily-news.yml`)

### Local Development

For local development with the full pipeline:
- Ensure `.env.local` contains your OpenAI API key
- GitHub Actions won't run locally, but you can manually trigger the pipeline via the API endpoints or run `node scripts/generate-daily-news.js`

## Routes

- `/` - Today's summary
- `/YYYY-MM-DD` - Specific date's summary (e.g., `/2025-01-11`)
- Custom 404 page for missing dates

## Development Scripts

```bash
npm run dev         # Start development server with Turbopack
npm run build       # Build for production
npm run start       # Start production server
npm run lint        # Run ESLint
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test locally
4. Commit with clear messages: `git commit -m "Add feature description"`
5. Push and create a Pull Request

## License

MIT License - see LICENSE file for details
