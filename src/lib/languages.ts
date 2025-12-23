export interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export type SourcePerspective = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export type SourceRegion = 'us' | 'eu' | 'uk' | 'asia' | 'africa' | 'latam' | 'mena' | 'global';
export type SourceType = 'wire' | 'broadsheet' | 'tabloid' | 'public-broadcaster' | 'aggregator';

export interface RSSFeed {
  name: string;
  url: string;
  description: string;
  perspective?: SourcePerspective;
  region?: SourceRegion;
  type?: SourceType;
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
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷'
  }
] as const;

export const RSS_FEEDS_BY_LANGUAGE: Record<string, RSSFeed[]> = {
  en: [
    // Wire Services (factual baseline)
    {
      name: 'Associated Press',
      url: 'https://feedx.net/rss/ap.xml',
      description: 'Global wire - AP news via FeedX mirror; broad geographic mix',
      perspective: 'center',
      region: 'global',
      type: 'wire'
    },
    {
      name: 'Reuters',
      url: 'https://www.reutersagency.com/feed/?taxonomy=best-regions&post_type=best',
      description: 'Premier wire service; factual baseline for breaking news',
      perspective: 'center',
      region: 'global',
      type: 'wire'
    },
    // US/UK Broadsheets
    {
      name: 'New York Times World',
      url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      description: 'NYT World desk - In-depth international coverage',
      perspective: 'center-left',
      region: 'us',
      type: 'broadsheet'
    },
    {
      name: 'Wall Street Journal World',
      url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
      description: 'WSJ World news - Financial and conservative perspective balance',
      perspective: 'center-right',
      region: 'us',
      type: 'broadsheet'
    },
    {
      name: 'The Guardian',
      url: 'https://www.theguardian.com/world/rss',
      description: 'Progressive daily - Guardian World; good features & environment coverage',
      perspective: 'left',
      region: 'uk',
      type: 'broadsheet'
    },
    // Public Broadcasters
    {
      name: 'BBC World',
      url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
      description: 'UK/global - BBC World desk; good for politics, science, and crises',
      perspective: 'center',
      region: 'uk',
      type: 'public-broadcaster'
    },
    {
      name: 'Deutsche Welle',
      url: 'https://rss.dw.com/rdf/rss-en-top',
      description: 'EU public broadcaster - DW "Top Stories"; strong Europe & Africa focus',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'NPR News',
      url: 'https://feeds.npr.org/1001/rss.xml',
      description: 'Public radio - NPR "News" stream; balanced US & world reporting',
      perspective: 'center-left',
      region: 'us',
      type: 'public-broadcaster'
    },
    {
      name: 'ABC Australia',
      url: 'https://www.abc.net.au/news/feed/51120/rss.xml',
      description: 'Australian public broadcaster - Pacific region coverage',
      perspective: 'center',
      region: 'asia',
      type: 'public-broadcaster'
    },
    // Asia-Pacific Sources
    {
      name: 'South China Morning Post',
      url: 'https://www.scmp.com/rss/91/feed',
      description: 'Hong Kong-based - Critical Asia-Pacific perspective',
      perspective: 'center',
      region: 'asia',
      type: 'broadsheet'
    },
    {
      name: 'The Hindu',
      url: 'https://www.thehindu.com/news/feeder/default.rss',
      description: 'Major Indian daily - South Asia coverage',
      perspective: 'center-left',
      region: 'asia',
      type: 'broadsheet'
    },
    {
      name: 'Japan Times',
      url: 'https://www.japantimes.co.jp/feed/',
      description: 'Japan\'s leading English newspaper - East Asia perspective',
      perspective: 'center',
      region: 'asia',
      type: 'broadsheet'
    },
    // Middle East / Global South
    {
      name: 'Al Jazeera English',
      url: 'https://www.aljazeera.com/xml/rss/all.xml',
      description: 'Global South slant - Al Jazeera English; adds non-Western framing',
      perspective: 'center',
      region: 'mena',
      type: 'public-broadcaster'
    },
    {
      name: 'France 24',
      url: 'https://www.france24.com/en/rss',
      description: 'French view in English - France 24 international desk; concise wires',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    // Africa
    {
      name: 'AllAfrica',
      url: 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf',
      description: 'Pan-African - AllAfrica aggregates 100+ African outlets',
      perspective: 'center',
      region: 'africa',
      type: 'aggregator'
    },
    // US Government-funded (different lens)
    {
      name: 'Voice of America',
      url: 'https://www.voanews.com/api/epiqq',
      description: 'US-funded world news - VOA adds US foreign-policy lens',
      perspective: 'center',
      region: 'us',
      type: 'public-broadcaster'
    }
  ],
  it: [
    // Wire Services
    {
      name: 'ANSA',
      url: 'https://www.ansa.it/sito/ansait_rss.xml',
      description: 'National wire-service headlines; terse, fact-first copy',
      perspective: 'center',
      region: 'eu',
      type: 'wire'
    },
    {
      name: 'AGI',
      url: 'https://www.agi.it/rss',
      description: 'Alternative wire service - adds diversity to ANSA',
      perspective: 'center',
      region: 'eu',
      type: 'wire'
    },
    // Public Broadcasters
    {
      name: 'Rai News',
      url: 'https://www.rainews.it/rss/tutti',
      description: 'Full public-broadcaster stream; solid politics & foreign desks',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'RSI (Swiss)',
      url: 'https://www.rsi.ch/news/rss/Tutte-le-news-2.rss',
      description: 'Swiss Italian broadcaster - neutral external perspective on Italy',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'Euronews Italiano',
      url: 'https://it.euronews.com/rss',
      description: 'European perspective on world news in Italian',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    // Broadsheets (left-right balance)
    {
      name: 'la Repubblica',
      url: 'https://www.repubblica.it/rss/esteri/rss2.0.xml',
      description: 'International desk of a centre-left daily',
      perspective: 'center-left',
      region: 'eu',
      type: 'broadsheet'
    },
    {
      name: 'Corriere della Sera',
      url: 'https://www.corriere.it/rss/homepage.xml',
      description: 'Major center-right daily - balances Repubblica',
      perspective: 'center-right',
      region: 'eu',
      type: 'broadsheet'
    },
    {
      name: 'Il Sole 24 Ore',
      url: 'https://www.ilsole24ore.com/rss/italia.xml',
      description: 'Business paper\'s national section; useful for economics & policy',
      perspective: 'center-right',
      region: 'eu',
      type: 'broadsheet'
    },
    // Commercial TV (breaking news)
    {
      name: 'TGCOM24',
      url: 'https://www.tgcom24.mediaset.it/rss/homepage.xml',
      description: 'Adds a commercial-TV perspective; good for breaking domestic stories',
      perspective: 'center-right',
      region: 'eu',
      type: 'tabloid'
    }
  ],
  fr: [
    // Broadsheets (political spectrum)
    {
      name: 'Le Monde',
      url: 'https://www.lemonde.fr/rss/une.xml',
      description: 'Premier quotidien français; couverture politique et internationale de référence',
      perspective: 'center-left',
      region: 'eu',
      type: 'broadsheet'
    },
    {
      name: 'Le Figaro',
      url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
      description: 'Quotidien de centre-droit; perspective équilibrée sur l\'actualité française',
      perspective: 'center-right',
      region: 'eu',
      type: 'broadsheet'
    },
    {
      name: 'Liberation',
      url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml',
      description: 'Quotidien de gauche; analyses approfondies et couverture sociale',
      perspective: 'left',
      region: 'eu',
      type: 'broadsheet'
    },
    {
      name: 'Les Echos',
      url: 'https://www.lesechos.fr/rss/rss_articles.xml',
      description: 'Quotidien économique - couverture financière et business approfondie',
      perspective: 'center-right',
      region: 'eu',
      type: 'broadsheet'
    },
    // Public Broadcasters
    {
      name: 'France Info',
      url: 'https://www.francetvinfo.fr/titres.rss',
      description: 'Service public d\'information; flux continu d\'actualités factuelles',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'France 24',
      url: 'https://www.france24.com/fr/rss',
      description: 'Chaîne internationale française; perspective française sur l\'actualité mondiale',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'RFI',
      url: 'https://www.rfi.fr/fr/rss',
      description: 'Radio France Internationale; couverture Afrique et monde francophone',
      perspective: 'center',
      region: 'africa',
      type: 'public-broadcaster'
    },
    // Swiss/Belgian/Canadian (external francophone perspectives)
    {
      name: 'RTS (Swiss)',
      url: 'https://www.rts.ch/info/rss/info.xml',
      description: 'Radio Télévision Suisse - perspective neutre suisse romande',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'RTBF (Belgian)',
      url: 'https://rss.rtbf.be/article/rss/rtbfinfo_homepage.xml',
      description: 'Radiodiffusion belge francophone - perspective belge sur l\'actualité',
      perspective: 'center',
      region: 'eu',
      type: 'public-broadcaster'
    },
    {
      name: 'Radio-Canada',
      url: 'https://ici.radio-canada.ca/rss/4159',
      description: 'Service public canadien - perspective nord-américaine francophone',
      perspective: 'center',
      region: 'us',
      type: 'public-broadcaster'
    },
    // Popular / Accessible
    {
      name: '20 Minutes',
      url: 'https://www.20minutes.fr/feeds/rss-monde.xml',
      description: 'Quotidien gratuit populaire; actualité mondiale accessible',
      perspective: 'center',
      region: 'eu',
      type: 'tabloid'
    },
    {
      name: 'L\'Express',
      url: 'https://www.lexpress.fr/rss/alaune.xml',
      description: 'Hebdomadaire d\'actualité; synthèses et analyses de fond',
      perspective: 'center',
      region: 'eu',
      type: 'broadsheet'
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