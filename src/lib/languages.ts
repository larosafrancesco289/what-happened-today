export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface RSSFeed {
  name: string;
  url: string;
  description: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹'
  }
] as const;

export const RSS_FEEDS_BY_LANGUAGE: Record<string, RSSFeed[]> = {
  en: [
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
  ],
  it: [
    {
      name: 'ANSA',
      url: 'https://www.ansa.it/sito/ansait_rss.xml',
      description: 'National wire-service headlines; terse, fact-first copy'
    },
    {
      name: 'Rai News',
      url: 'https://www.rainews.it/rss/tutti',
      description: 'Full public-broadcaster stream; solid politics & foreign desks'
    },
    {
      name: 'TGCOM24',
      url: 'https://www.tgcom24.mediaset.it/rss/homepage.xml',
      description: 'Adds a commercial-TV perspective; good for breaking domestic stories'
    },
    {
      name: 'Corriere della Sera',
      url: 'https://www.corriere.it/feed-hp/homepage.xml',
      description: 'Italy\'s largest daily; broad news mix'
    },
    {
      name: 'la Repubblica',
      url: 'https://www.repubblica.it/rss/esteri/rss2.0.xml',
      description: 'International desk of a centre-left daily; balances Corriere'
    },
    {
      name: 'Il Post',
      url: 'https://www.ilpost.it/feed',
      description: 'Concise, analytic independent outlet; low clickbait quotient'
    },
    {
      name: 'Internazionale',
      url: 'https://www.internazionale.it/rss',
      description: 'Curated translations of world journalism; broadens geographic range'
    },
    {
      name: 'Il Sole 24 Ore',
      url: 'https://www.ilsole24ore.com/rss/italia.xml',
      description: 'Business paper\'s national section; useful for economics & policy'
    }
  ]
} as const;

export function getLanguageFromCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find(lang => lang.code === code);
}

export function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  
  const browserLang = navigator.language.split('-')[0];
  const supportedCodes = SUPPORTED_LANGUAGES.map(lang => lang.code);
  
  return supportedCodes.includes(browserLang) ? browserLang : 'en';
} 