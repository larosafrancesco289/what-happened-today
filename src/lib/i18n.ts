export interface Translations {
  common: {
    loading: string;
    error: string;
    noData: string;
    retry: string;
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
    readMore: string;
    sources: string;
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
      retry: "Try again"
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
      headlines: "Headlines",
      readMore: "Read more",
      sources: "Sources"
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
      retry: "Riprova"
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
      headlines: "Titoli",
      readMore: "Leggi di più",
      sources: "Fonti"
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
      retry: "Réessayer"
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
      headlines: "Titres",
      readMore: "Lire plus",
      sources: "Sources"
    },
    meta: {
      title: "Que S'est-il Passé Aujourd'hui",
      description: "Un résumé quotidien propre et généré par l'IA de l'actualité mondiale — libre de clickbait, d'émotion et de surcharge d'informations."
    }
  }
};

export function getTranslations(languageCode: string): Translations {
  return translations[languageCode] || translations.en;
} 