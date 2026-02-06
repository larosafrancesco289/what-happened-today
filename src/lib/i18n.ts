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
    }
  }
};

export function getTranslations(languageCode: string): Translations {
  return translations[languageCode] ?? translations.en;
}
