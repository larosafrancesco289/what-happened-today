export interface Translations {
  common: {
    loading: string;
    error: string;
    noData: string;
    retry: string;
    unavailableTitle: string;
    unavailableMessage: string;
  };
  navigation: {
    previousDay: string;
    nextDay: string;
    today: string;
  };
  summary: {
    title: string;
    noSummaryTitle: string;
    noSummaryMessage: string;
    noSummaryDescription: string;
    headlines: string;
    dailySummary: string;
    readMore: string;
    sources: string;
    noHeadlines: string;
  };
  categories: {
    all: string;
    conflict: string;
    politics: string;
    economy: string;
    science: string;
    environment: string;
    society: string;
  };
  regions: {
    europe: string;
    americas: string;
    'asia-pacific': string;
    'middle-east': string;
    africa: string;
    global: string;
  };
  importance: {
    breaking: string;
    major: string;
    notable: string;
  };
  tiers: {
    topStories: string;
    alsoToday: string;
    developing: string;
  };
  continuity: {
    day: string;
    updated: string;
  };
  sources: {
    title: string;
    disclaimer: string;
  };
  meta: {
    title: string;
    description: string;
  };
  pipeline: {
    filterRatio: string;
    funnelFetched: string;
    funnelDedup: string;
    funnelFiltered: string;
    funnelPublished: string;
    sourcePlural: string;
    singleSource: string;
    regionCoverage: string;
    sourceType: Record<string, string>;
    sourcePerspective: Record<string, string>;
  };
  framing: {
    title: string;
    angle: string;
  };
  weekly: {
    title: string;
    subtitle: string;
    persistentStories: string;
    persistentDays: string;
    topHeadlines: string;
    daysWithData: string;
    noDigest: string;
    backToToday: string;
    fadedStories: string;
    fadedDescription: string;
    escalatedStories: string;
    escalatedDescription: string;
  };
}

export const translations: Record<string, Translations> = {
  en: {
    common: {
      loading: "Loading...",
      error: "An error occurred",
      noData: "No data available",
      retry: "Try again",
      unavailableTitle: "News Temporarily Unavailable",
      unavailableMessage: "We couldn't generate today's news summary for this language. Please try another language or check back later."
    },
    navigation: {
      previousDay: "Previous day",
      nextDay: "Next day",
      today: "Today"
    },
    summary: {
      title: "What Happened Today",
      noSummaryTitle: "What Happened Today",
      noSummaryMessage: "No summary available for today yet.",
      noSummaryDescription: "The daily summary will be generated automatically.",
      dailySummary: "Daily Summary",
      headlines: "Headlines",
      readMore: "Read more",
      sources: "Sources",
      noHeadlines: "No headlines in this category."
    },
    categories: {
      all: "All",
      conflict: "Conflict",
      politics: "Politics",
      economy: "Economy",
      science: "Science",
      environment: "Environment",
      society: "Society"
    },
    regions: {
      europe: "Europe",
      americas: "Americas",
      'asia-pacific': "Asia-Pacific",
      'middle-east': "Middle East",
      africa: "Africa",
      global: "Global"
    },
    importance: {
      breaking: "BREAKING",
      major: "MAJOR",
      notable: "Notable"
    },
    tiers: {
      topStories: "Top Stories",
      alsoToday: "Also Today",
      developing: "Developing"
    },
    continuity: {
      day: "Day",
      updated: "Updated"
    },
    sources: {
      title: "Today's sources",
      disclaimer: "Stories are sourced from multiple outlets representing diverse geographic and editorial perspectives. Summaries are AI-generated for neutrality and clarity."
    },
    meta: {
      title: "What Happened Today",
      description: "A clean, AI-generated daily summary of global news — free from clickbait, emotion, and information overload."
    },
    pipeline: {
      filterRatio: "{stories} stories selected from {articles} articles across {sources} sources",
      funnelFetched: "fetched",
      funnelDedup: "deduplicated",
      funnelFiltered: "filtered",
      funnelPublished: "published",
      sourcePlural: "sources",
      singleSource: "Single source",
      regionCoverage: "Coverage today",
      sourceType: {
        wire: "Wire service",
        broadsheet: "Broadsheet",
        tabloid: "Popular press",
        "public-broadcaster": "Public broadcaster",
        aggregator: "Aggregator",
      },
      sourcePerspective: {
        left: "Left-leaning",
        "center-left": "Center-left",
        center: "Center",
        "center-right": "Center-right",
        right: "Right-leaning",
      },
    },
    framing: {
      title: "How sources framed this",
      angle: "Emphasis",
    },
    weekly: {
      title: "This Week",
      subtitle: "Weekly briefing",
      persistentStories: "Persistent stories",
      persistentDays: "days",
      topHeadlines: "Top headlines this week",
      daysWithData: "days covered",
      noDigest: "No weekly digest available yet.",
      backToToday: "Back to today",
      fadedStories: "Faded quickly",
      fadedDescription: "Appeared one day only",
      escalatedStories: "Grew in prominence",
      escalatedDescription: "Started small, became a top story",
    }
  },
  it: {
    common: {
      loading: "Caricamento...",
      error: "Si è verificato un errore",
      noData: "Nessun dato disponibile",
      retry: "Riprova",
      unavailableTitle: "Notizie Temporaneamente Non Disponibili",
      unavailableMessage: "Non è stato possibile generare il riassunto delle notizie di oggi per questa lingua. Prova un'altra lingua o ricontrolla più tardi."
    },
    navigation: {
      previousDay: "Giorno precedente",
      nextDay: "Giorno successivo",
      today: "Oggi"
    },
    summary: {
      title: "Cosa È Successo Oggi",
      noSummaryTitle: "Cosa È Successo Oggi",
      noSummaryMessage: "Nessun riassunto disponibile per oggi.",
      noSummaryDescription: "Il riassunto giornaliero verrà generato automaticamente.",
      dailySummary: "Riassunto Giornaliero",
      headlines: "Titoli",
      readMore: "Leggi di più",
      sources: "Fonti",
      noHeadlines: "Nessun titolo in questa categoria."
    },
    categories: {
      all: "Tutti",
      conflict: "Conflitto",
      politics: "Politica",
      economy: "Economia",
      science: "Scienza",
      environment: "Ambiente",
      society: "Società"
    },
    regions: {
      europe: "Europa",
      americas: "Americhe",
      'asia-pacific': "Asia-Pacifico",
      'middle-east': "Medio Oriente",
      africa: "Africa",
      global: "Globale"
    },
    importance: {
      breaking: "BREAKING",
      major: "IMPORTANTE",
      notable: "Notevole"
    },
    tiers: {
      topStories: "Notizie Principali",
      alsoToday: "Anche Oggi",
      developing: "In Sviluppo"
    },
    continuity: {
      day: "Giorno",
      updated: "Aggiornato"
    },
    sources: {
      title: "Fonti di oggi",
      disclaimer: "Le notizie provengono da diverse testate che rappresentano prospettive geografiche ed editoriali diverse. I riassunti sono generati dall'IA per neutralità e chiarezza."
    },
    meta: {
      title: "Cosa È Successo Oggi",
      description: "Un riassunto giornaliero pulito e generato dall'IA delle notizie globali — libero da clickbait, emozioni e sovraccarico di informazioni."
    },
    pipeline: {
      filterRatio: "{stories} notizie selezionate da {articles} articoli di {sources} fonti",
      funnelFetched: "raccolti",
      funnelDedup: "deduplicati",
      funnelFiltered: "filtrati",
      funnelPublished: "pubblicati",
      sourcePlural: "fonti",
      singleSource: "Fonte unica",
      regionCoverage: "Copertura di oggi",
      sourceType: {
        wire: "Agenzia di stampa",
        broadsheet: "Quotidiano di qualità",
        tabloid: "Stampa popolare",
        "public-broadcaster": "Emittente pubblica",
        aggregator: "Aggregatore",
      },
      sourcePerspective: {
        left: "Sinistra",
        "center-left": "Centro-sinistra",
        center: "Centro",
        "center-right": "Centro-destra",
        right: "Destra",
      },
    },
    framing: {
      title: "Come le fonti hanno trattato la notizia",
      angle: "Enfasi",
    },
    weekly: {
      title: "Questa Settimana",
      subtitle: "Briefing settimanale",
      persistentStories: "Storie persistenti",
      persistentDays: "giorni",
      topHeadlines: "Titoli principali della settimana",
      daysWithData: "giorni coperti",
      noDigest: "Nessun digest settimanale disponibile.",
      backToToday: "Torna a oggi",
      fadedStories: "Svanite rapidamente",
      fadedDescription: "Apparse un solo giorno",
      escalatedStories: "Cresciute di importanza",
      escalatedDescription: "Iniziate in sordina, diventate notizia principale",
    }
  },
  fr: {
    common: {
      loading: "Chargement...",
      error: "Une erreur s'est produite",
      noData: "Aucune donnée disponible",
      retry: "Réessayer",
      unavailableTitle: "Actualités Temporairement Indisponibles",
      unavailableMessage: "Nous n'avons pas pu générer le résumé des actualités du jour pour cette langue. Veuillez essayer une autre langue ou revenir plus tard."
    },
    navigation: {
      previousDay: "Jour précédent",
      nextDay: "Jour suivant",
      today: "Aujourd'hui"
    },
    summary: {
      title: "Que S'est-il Passé Aujourd'hui",
      noSummaryTitle: "Que S'est-il Passé Aujourd'hui",
      noSummaryMessage: "Aucun résumé disponible pour aujourd'hui.",
      noSummaryDescription: "Le résumé quotidien sera généré automatiquement.",
      dailySummary: "Résumé Quotidien",
      headlines: "Titres",
      readMore: "Lire plus",
      sources: "Sources",
      noHeadlines: "Aucun titre dans cette catégorie."
    },
    categories: {
      all: "Tous",
      conflict: "Conflit",
      politics: "Politique",
      economy: "Économie",
      science: "Science",
      environment: "Environnement",
      society: "Société"
    },
    regions: {
      europe: "Europe",
      americas: "Amériques",
      'asia-pacific': "Asie-Pacifique",
      'middle-east': "Moyen-Orient",
      africa: "Afrique",
      global: "Mondial"
    },
    importance: {
      breaking: "BREAKING",
      major: "MAJEUR",
      notable: "Notable"
    },
    tiers: {
      topStories: "A la Une",
      alsoToday: "Également Aujourd'hui",
      developing: "En Développement"
    },
    continuity: {
      day: "Jour",
      updated: "Mis à jour"
    },
    sources: {
      title: "Sources du jour",
      disclaimer: "Les articles proviennent de plusieurs médias représentant des perspectives géographiques et éditoriales diverses. Les résumés sont générés par IA pour la neutralité et la clarté."
    },
    meta: {
      title: "Que S'est-il Passé Aujourd'hui",
      description: "Un résumé quotidien propre et généré par l'IA de l'actualité mondiale — libre de clickbait, d'émotion et de surcharge d'informations."
    },
    pipeline: {
      filterRatio: "{stories} sujets retenus sur {articles} articles de {sources} sources",
      funnelFetched: "collectés",
      funnelDedup: "dédupliqués",
      funnelFiltered: "filtrés",
      funnelPublished: "publiés",
      sourcePlural: "sources",
      singleSource: "Source unique",
      regionCoverage: "Couverture du jour",
      sourceType: {
        wire: "Agence de presse",
        broadsheet: "Quotidien de référence",
        tabloid: "Presse populaire",
        "public-broadcaster": "Média public",
        aggregator: "Agrégateur",
      },
      sourcePerspective: {
        left: "Gauche",
        "center-left": "Centre-gauche",
        center: "Centre",
        "center-right": "Centre-droit",
        right: "Droite",
      },
    },
    framing: {
      title: "Comment les sources ont traité cette info",
      angle: "Angle",
    },
    weekly: {
      title: "Cette Semaine",
      subtitle: "Briefing hebdomadaire",
      persistentStories: "Histoires persistantes",
      persistentDays: "jours",
      topHeadlines: "Grands titres de la semaine",
      daysWithData: "jours couverts",
      noDigest: "Aucun digest hebdomadaire disponible.",
      backToToday: "Retour à aujourd'hui",
      fadedStories: "Disparues rapidement",
      fadedDescription: "Apparues un seul jour",
      escalatedStories: "Montées en importance",
      escalatedDescription: "Commencées discrètement, devenues une des nouvelles principales",
    }
  }
};

export function getTranslations(languageCode: string): Translations {
  return translations[languageCode] ?? translations.en;
}
