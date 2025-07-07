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
      name: 'la Repubblica',
      url: 'https://www.repubblica.it/rss/esteri/rss2.0.xml',
      description: 'International desk of a centre-left daily; balances Corriere'
    },
    {
      name: 'Il Sole 24 Ore',
      url: 'https://www.ilsole24ore.com/rss/italia.xml',
      description: 'Business paper\'s national section; useful for economics & policy'
    }
  ],
  fr: [
    {
      name: 'Le Monde',
      url: 'https://www.lemonde.fr/rss/une.xml',
      description: 'Premier quotidien français; couverture politique et internationale de référence'
    },
    {
      name: 'Le Figaro',
      url: 'https://www.lefigaro.fr/rss/figaro_actualites.xml',
      description: 'Quotidien de centre-droit; perspective équilibrée sur l\'actualité française'
    },
    {
      name: 'France Info',
      url: 'https://www.francetvinfo.fr/titres.rss',
      description: 'Service public d\'information; flux continu d\'actualités factuelles'
    },
    {
      name: 'Liberation',
      url: 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml',
      description: 'Quotidien de gauche; analyses approfondies et couverture sociale'
    },
    {
      name: 'Les Echos',
      url: 'https://www.lesechos.fr/rss/monde.xml',
      description: 'Quotidien économique; actualité internationale sous l\'angle économique'
    },
    {
      name: 'L\'Express',
      url: 'https://www.lexpress.fr/rss/alaune.xml',
      description: 'Hebdomadaire d\'actualité; synthèses et analyses de fond'
    },
    {
      name: 'France 24',
      url: 'https://www.france24.com/fr/rss',
      description: 'Chaîne internationale française; perspective française sur l\'actualité mondiale'
    },
    {
      name: 'RFI',
      url: 'https://www.rfi.fr/fr/rss',
      description: 'Radio France Internationale; couverture Afrique et monde francophone'
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