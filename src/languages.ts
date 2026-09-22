export const LANGS = ['en', 'it', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

interface Strings {
  name: string;
  locale: string;
  siteName: string;
  description: string;
  stories: string;
  archive: string;
  staleNotice: (date: string) => string;
  about: (model: string | undefined) => string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    name: 'English',
    locale: 'en-GB',
    siteName: 'What Happened Today',
    description: 'The day’s most important news in five minutes, without the noise.',
    stories: 'The stories',
    archive: 'Archive',
    staleNotice: date => `Today’s edition isn’t out yet. This is the latest, from ${date}.`,
    about: model => `Written each morning by ${model ?? 'an AI model'} from public news feeds. Every story links to its sources.`,
  },
  it: {
    name: 'Italiano',
    locale: 'it-IT',
    siteName: 'Cosa è successo oggi',
    description: 'Le notizie più importanti del giorno in cinque minuti, senza rumore.',
    stories: 'Le notizie',
    archive: 'Archivio',
    staleNotice: date => `L’edizione di oggi non è ancora uscita. Questa è l’ultima, del ${date}.`,
    about: model => `Scritto ogni mattina da ${model ?? 'un modello di IA'} a partire da fonti giornalistiche pubbliche. Ogni notizia rimanda alle sue fonti.`,
  },
  fr: {
    name: 'Français',
    locale: 'fr-FR',
    siteName: 'Ce qui s’est passé aujourd’hui',
    description: 'L’essentiel de l’actualité du jour en cinq minutes, sans le bruit.',
    stories: 'Les sujets',
    archive: 'Archives',
    staleNotice: date => `L’édition du jour n’est pas encore parue. Voici la dernière, du ${date}.`,
    about: model => `Rédigé chaque matin par ${model ?? 'un modèle d’IA'} à partir de flux d’actualité publics. Chaque sujet renvoie à ses sources.`,
  },
};

/** Dates are stored as YYYY-MM-DD; format them at noon UTC so no timezone shifts the day. */
export function formatDate(date: string, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(STRINGS[lang].locale, { timeZone: 'UTC', ...options });
}
