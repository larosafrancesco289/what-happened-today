# What Happened Today

A clean, AI-generated daily summary of global news — free from clickbait, emotion, and information overload.

## Features

- **Clean Daily Summaries**: Two-paragraph AI-generated summaries of global events
- **Ranked Headlines**: Top 5-10 stories with neutral, factual summaries  
- **Mobile-First Design**: Responsive UI built with Tailwind CSS
- **Date Navigation**: Browse previous days' summaries
- **Minimal & Fast**: Clean design focused on readability

## Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Hosting**: Vercel (ready to deploy)
- **Data Storage**: JSON files per day (`/data/YYYY-MM-DD.json`)
- **Icons**: Heroicons
- **Styling**: Tailwind CSS with Inter font

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**: [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── [date]/          # Dynamic route for specific dates
│   ├── layout.tsx       # Root layout with metadata
│   └── page.tsx         # Home page (today's summary)
├── components/
│   ├── DateNavigation.tsx  # Navigation between dates
│   ├── LoadingSpinner.tsx  # Loading component
│   └── NewsSummary.tsx     # Main content display
├── lib/
│   └── utils.ts         # Utility functions for dates/data
└── types/
    └── news.ts          # TypeScript interfaces

data/
└── YYYY-MM-DD.json     # Daily summary files
```

## Data Format

Each daily summary follows this JSON structure:

```json
{
  "date": "2025-01-11",
  "summary": "Two-paragraph summary...",
  "headlines": [
    {
      "title": "Headline text",
      "source": "Source name",
      "summary": "Brief summary",
      "link": "https://..."
    }
  ]
}
```

## Planned Features

- [ ] RSS feed ingestion (`/api/cron`)
- [ ] AI processing with GPT-4.1-mini
- [ ] Automated daily generation
- [ ] Source filtering and ranking
- [ ] Vercel Cron Jobs for scheduling

## Routes

- `/` - Today's summary
- `/YYYY-MM-DD` - Specific date's summary
- `404` - Custom not found page

## Deployment

Ready for one-click deployment to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/what-happened-today)

## License

MIT
