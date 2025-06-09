# Setup Guide for News Pipeline

## Environment Variables

Create a `.env.local` file in the root directory with:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## API Endpoints

### `/api/cron` (Production Pipeline)
- Fetches RSS feeds from 10 diverse global news sources (Reuters, AP, BBC World, Al Jazeera English, Deutsche Welle, Guardian World, France 24, NPR, AllAfrica, VOA)
- Uses GPT-4.1-mini with structured output to filter, rank, and summarize articles
- Generates daily JSON file with neutral, factual content
- Runs automatically via Vercel Cron at 6 AM UTC

### `/api/test-pipeline` (Development Testing)
- Uses mock data to test the pipeline
- Generates sample daily JSON file
- Safe to run without API credits

## Testing the Pipeline

1. **Test with mock data (no API calls):**
   ```
   curl http://localhost:3000/api/test-pipeline
   ```

2. **Test full pipeline (requires OpenAI API key):**
   ```
   curl http://localhost:3000/api/cron
   ```

## Data Structure

Daily news files are saved in `/data/YYYY-MM-DD.json` with:

```json
{
  "date": "2025-01-09",
  "summary": "Two paragraph AI-generated summary...",
  "headlines": [
    {
      "title": "Headline",
      "source": "Source Name",
      "summary": "Brief summary",
      "link": "https://..."
    }
  ]
}
```

## RSS Feed Sources

The pipeline uses 10 diverse global news sources for comprehensive coverage:

- **Reuters** - Fast, factual wire copy; minimal clickbait
- **Associated Press** - AP "Top News" stream; broad geographic mix
- **BBC World** - BBC World desk; good for politics, science, and crises
- **Al Jazeera English** - Adds non-Western framing and Global South perspective
- **Deutsche Welle** - EU public broadcaster; strong Europe & Africa focus
- **The Guardian** - Progressive daily; good features & environment coverage
- **France 24** - French view in English; concise international wires
- **NPR News** - US public radio; balanced US & world reporting
- **AllAfrica** - Pan-African perspective from 100+ African outlets
- **Voice of America** - US-funded world news with foreign-policy lens

## Deployment

The `vercel.json` file is configured to run the cron job daily at 6 AM UTC.
Make sure to set the `OPENAI_API_KEY` environment variable in your Vercel dashboard. 