import type { Lang } from '../languages';

/** [outlet name, RSS URL] per edition language. */
export const FEEDS: Record<Lang, [string, string][]> = {
  en: [
    ['New York Times', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
    ['Wall Street Journal', 'https://feeds.content.dowjones.io/public/rss/RSSWorldNews'],
    ['The Guardian', 'https://www.theguardian.com/world/rss'],
    ['BBC', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
    ['Deutsche Welle', 'https://rss.dw.com/xml/rss-en-all'],
    ['NPR', 'https://feeds.npr.org/1001/rss.xml'],
    ['ABC Australia', 'https://www.abc.net.au/news/feed/51120/rss.xml'],
    ['South China Morning Post', 'https://www.scmp.com/rss/91/feed'],
    ['The Hindu', 'https://www.thehindu.com/news/feeder/default.rss'],
    ['Japan Times', 'https://www.japantimes.co.jp/feed/'],
    ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml'],
    ['France 24', 'https://www.france24.com/en/rss'],
    ['AllAfrica', 'https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf'],
  ],
  it: [
    ['ANSA', 'https://www.ansa.it/sito/ansait_rss.xml'],
    ['AGI', 'https://www.agi.it/rss'],
    ['Rai News', 'https://www.rainews.it/rss/tutti'],
    ['Euronews', 'https://it.euronews.com/rss'],
    ['la Repubblica', 'https://www.repubblica.it/rss/esteri/rss2.0.xml'],
    ['Il Sole 24 Ore', 'https://www.ilsole24ore.com/rss/italia.xml'],
    ['TGCOM24', 'https://www.tgcom24.mediaset.it/rss/homepage.xml'],
  ],
  fr: [
    ['Le Monde', 'https://www.lemonde.fr/rss/une.xml'],
    ['Le Figaro', 'https://www.lefigaro.fr/rss/figaro_actualites.xml'],
    ['Libération', 'https://www.liberation.fr/arc/outboundfeeds/rss-all/?outputType=xml'],
    ['franceinfo', 'https://www.francetvinfo.fr/titres.rss'],
    ['France 24', 'https://www.france24.com/fr/rss'],
    ['RFI', 'https://www.rfi.fr/fr/rss'],
    ['RTBF', 'https://rss.rtbf.be/article/rss/rtbfinfo_homepage.xml'],
    ['Radio-Canada', 'https://ici.radio-canada.ca/rss/4159'],
    ['20 Minutes', 'https://www.20minutes.fr/feeds/rss-monde.xml'],
    ['L’Express', 'https://www.lexpress.fr/rss/alaune.xml'],
  ],
};
