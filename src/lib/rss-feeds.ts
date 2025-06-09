// Re-export from languages.ts for the new language-based system
export { RSS_FEEDS_BY_LANGUAGE, type RSSFeed } from './languages';

// Keep the old RSS_FEEDS export for backward compatibility (English feeds)
export const RSS_FEEDS = [
  {
    name: 'Reuters',
    url: 'http://feeds.reuters.com/reuters/topNews',
    description: 'Global wire - Fast, factual wire copy; minimal clickbait'
  },
  {
    name: 'Associated Press',
    url: 'https://apnews.com/index.rss',
    description: 'Global wire #2 - AP "Top News" stream; broad geographic mix'
  },
  {
    name: 'BBC World',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    description: 'UK/global - BBC World desk; good for politics, science, and crises'
  },
  {
    name: 'Al Jazeera English',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    description: 'Global South slant - Al Jazeera English; adds non-Western framing'
  },
  {
    name: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-top',
    description: 'EU public broadcaster - DW "Top Stories"; strong Europe & Africa focus'
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    description: 'Progressive daily - Guardian World; good features & environment coverage'
  },
  {
    name: 'France 24',
    url: 'https://www.france24.com/en/rss',
    description: 'French view in English - France 24 international desk; concise wires'
  },
  {
    name: 'NPR News',
    url: 'https://feeds.npr.org/1001/rss.xml',
    description: 'Public radio - NPR "News" stream; balanced US & world reporting'
  },
  {
    name: 'AllAfrica',
    url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
    description: 'Pan-African - AllAfrica aggregates 100+ African outlets'
  },
  {
    name: 'Voice of America',
    url: 'https://www.voanews.com/api/z$-mqeqt$qti',
    description: 'US-funded world news - VOA adds US foreign-policy lens'
  }
] as const; 