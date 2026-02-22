import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline, Category, Region, Importance, Tier } from '@/types/news';
import { safeParseJSON } from '@/lib/utils';

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY?.trim(),
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 90000,
  maxRetries: 0,
  defaultHeaders: {
    'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://what-happened-today.vercel.app',
    'X-Title': process.env.OPENROUTER_SITE_NAME || 'What Happened Today',
  },
});

// Model configuration (OpenRouter format: provider/model)
// Fast model for filtering and headlines, quality model for summaries
// See available models at: https://openrouter.ai/models
const MODEL_FILTER = 'nvidia/nemotron-3-nano-30b-a3b';
const MODEL_HEADLINES = 'x-ai/grok-4.1-fast';
const MODEL_SUMMARY = 'x-ai/grok-4.1-fast';
const MODEL_SUMMARY_FALLBACK = process.env.OPENROUTER_MODEL_SUMMARY_FALLBACK?.trim() || 'openai/gpt-4o-mini';

// Helper function to retry operations with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: wait baseDelay * 2^attempt ms
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

interface ArticleAnalysis {
  index: number;
  relevanceScore: number;
  isRelevant: boolean;
  reason: string;
}

type SupportedPromptLang = 'en' | 'it' | 'fr';

function getPrompts(languageCode: string): typeof LANGUAGE_PROMPTS[SupportedPromptLang] {
  return LANGUAGE_PROMPTS[(languageCode as SupportedPromptLang)] ?? LANGUAGE_PROMPTS.en;
}

function normalizeSummaryText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .trim();
}

/**
 * Recover summary text from malformed model output that is close to JSON but invalid.
 * This avoids false "unavailable" days when the model returns usable prose with broken wrappers.
 */
function recoverSummaryFromMalformedOutput(responseText: string): string | null {
  const trimmed = responseText.trim();
  if (!trimmed) return null;

  const valid = safeParseJSON<{ summary?: string }>(trimmed, {});
  if (valid.summary && valid.summary.trim().length > 0) {
    return valid.summary.trim();
  }

  const summaryKeyMatch = trimmed.match(/"summary"\s*:\s*"([\s\S]*)$/i);
  if (summaryKeyMatch?.[1]) {
    const candidate = normalizeSummaryText(summaryKeyMatch[1]).replace(/"\s*}?\s*$/, '').trim();
    if (candidate.length >= 120) return candidate;
  }

  const brokenKeyThenText = trimmed.match(/^\s*\{\s*"summary:?["']?\s*\}?\s*\n?([\s\S]+)$/i);
  if (brokenKeyThenText?.[1]) {
    const candidate = normalizeSummaryText(brokenKeyThenText[1]);
    if (candidate.length >= 120) return candidate;
  }

  if (trimmed.includes('\n')) {
    const afterFirstLine = normalizeSummaryText(trimmed.slice(trimmed.indexOf('\n') + 1))
      .replace(/^summary\s*[:\-]\s*/i, '')
      .trim();
    if (afterFirstLine.length >= 120 && !afterFirstLine.startsWith('{')) {
      return afterFirstLine;
    }
  }

  return null;
}

/**
 * Format articles for inclusion in headline prompts.
 * Shared across all language prompts to avoid duplicating the covering-articles logic.
 */
function formatArticlesForPrompt(articles: ProcessedArticle[], alsoLabel: string): string {
  return articles.map((a, i) => {
    let entry = `[${i}] ${a.source}: ${a.title}${a.coveringSources ? ` [${alsoLabel}: ${a.coveringSources.join(', ')}]` : ''}\n${a.content.substring(0, 600)}\nLink: ${a.link}`;
    if (a.coveringArticles && a.coveringArticles.length > 0) {
      entry += '\n' + a.coveringArticles.map(ca => `${ca.source} version (300 chars): ${ca.content.substring(0, 300)}\nLink: ${ca.link}`).join('\n');
    }
    return entry;
  }).join('\n\n');
}

/**
 * Format a "yesterday headlines" section for memory/continuity.
 * Returns an empty string when there are no yesterday headlines.
 */
function formatYesterdayMemory(yesterdayHeadlines: NewsHeadline[], header: string, instructions: string): string {
  if (yesterdayHeadlines.length === 0) return '';
  return `\n${header}:\n${yesterdayHeadlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}\n${instructions}\n\n`;
}

/**
 * Format a "yesterday context" section for summary prompts.
 * Returns an empty string when there are no yesterday headlines.
 */
function formatYesterdayContext(yesterdayHeadlines: NewsHeadline[], header: string): string {
  if (yesterdayHeadlines.length === 0) return '';
  return `\n${header}:\n${yesterdayHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`).join('\n')}\n\n`;
}

const SYSTEM_PROMPTS: Record<SupportedPromptLang, { headlines: string; summary: string }> = {
  en: {
    headlines: 'You are a neutral news editor. Write all headlines and summaries in English. Output valid JSON only.',
    summary: 'You are a neutral news writer. Write the summary in plain English. Output valid JSON only.',
  },
  it: {
    headlines: 'Sei un redattore neutrale. Scrivi TUTTI i titoli e sommari in ITALIANO. Output solo JSON valido.',
    summary: 'Sei un giornalista neutrale. Scrivi il riassunto in ITALIANO semplice e chiaro. Output solo JSON valido.',
  },
  fr: {
    headlines: 'Vous êtes un rédacteur neutre. Écrivez TOUS les titres et résumés en FRANÇAIS. Output JSON valide uniquement.',
    summary: 'Vous êtes un journaliste neutre. Rédigez le résumé en FRANÇAIS simple et clair. Output JSON valide uniquement.',
  },
};

function getSystemPrompt(languageCode: string, role: 'headlines' | 'summary'): string {
  const lang = (languageCode as SupportedPromptLang);
  return SYSTEM_PROMPTS[lang]?.[role] ?? SYSTEM_PROMPTS.en[role];
}

const LANGUAGE_PROMPTS = {
  en: {
    filterPrompt: (articles: ProcessedArticle[]) => `Score each article from 0-10 for newsworthiness. Output JSON only.

SCORING CRITERIA:
9-10 = Major verified event (war development, disaster 100+ casualties, election result, major policy change)
7-8 = Significant national news with international implications
5-6 = Notable concrete development worth reporting
3-4 = Minor update, routine event, or analysis without new facts
0-2 = Opinion, duplicate, rumor, entertainment, or clickbait

MANDATORY KEEP:
- Government actions affecting citizens
- Confirmed armed conflicts with casualties/territory changes
- Natural disasters (10+ deaths OR major infrastructure damage)
- Election results or major policy changes
- Economic indicators (GDP, inflation, major market moves)
- Peer-reviewed scientific breakthroughs
- International agreements or diplomatic shifts

MANDATORY DROP:
- Celebrity/sports/entertainment (unless death or major scandal)
- Local-only stories without broader relevance
- Pure opinion pieces or predictions
- "Reactions to" or "Analysis of" without new facts
- Video-only content without textual facts
- Promotional or sponsored content
- Headlines with sensational words: "slams", "blasts", "rocks", "shock", "stunning"

DIVERSITY REQUIREMENTS:
- If same event covered by multiple sources, keep the most comprehensive version
- Aim for geographic diversity: include stories from different world regions when available
- Prefer stories verified by 2+ sources for breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        "YESTERDAY'S HEADLINES (for continuity — do NOT repeat unless there is a NEW development)",
        'For ongoing stories from yesterday with new developments, place them in the "developing" tier with dayNumber (how many consecutive days) and previousContext (what specifically changed today).'
      );

      return `Create headlines + summaries for distinct news events. Write in clear, factual English.

TIER SYSTEM — Generate 8-15 headlines in 3 tiers:
- "top" (2-4): Day's most important events, full detailed summaries
- "also" (3-6): Important but not lead stories, shorter summaries
- "developing" (0-3): Ongoing stories from yesterday with what specifically changed today
If fewer than 8 stories meet the quality threshold, produce fewer. Never pad with marginal stories.
${memorySection}
HEADLINE RULES:
- 8-14 words, active voice, present tense for today's events
- Subject-Verb-Object structure (WHO did WHAT to WHOM)
- NO sensational words: slams, blasts, rocks, shock, stunning, chaos, crisis (unless literal)
- NO question headlines or cliffhangers
- Include specific numbers when available (casualties, amounts, percentages)

SUMMARY RULES:
- 25-40 words covering: What happened, Who is affected, What happens next
- Include specific numbers, dates, or locations when relevant
- State the significance: why this matters to readers

MULTI-SOURCE: When input articles have coveringSources, include all sources in a "sources" array field.

SINGLE-SOURCE: If an article has NO [Also: ...] annotation, include "singleSource": true in the JSON.

FRAMING: For multi-source stories, add a "framings" array showing how each source approached the story.
Each framing: {"source":"AP","angle":"Led with casualty figures and blast mechanics","link":"..."}
The angle should be 8-15 words describing what the source emphasized, NOT an opinion about the source.

IMPORTANT: Each story must appear in exactly ONE tier. Do not place the same event in both "top" and "developing".

OUTPUT JSON FORMAT:
{"headlines":[{"title":"...","source":"PrimarySource","sources":["Source1","Source2"],"summary":"...","link":"...","tier":"top","framings":[{"source":"AP","angle":"...","link":"..."}]},{"title":"...","source":"SingleSource","summary":"...","link":"...","tier":"also","singleSource":true},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"Fighting shifted from X to Y"},...]}

ARTICLES:
${formatArticlesForPrompt(articles, 'Also')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        "YESTERDAY'S CONTEXT (for reference — do not repeat old information, only mention what changed)"
      );

      return `Write a 2-3 paragraph daily news briefing (250-350 words). Your goal is to help readers understand the world in 90 seconds.

STRUCTURE:
Paragraph 1: Lead with the most significant global story. Provide factual context.
Paragraph 2: Cover 2-3 other major stories, connecting related events where factual links exist.
Paragraph 3: Cover remaining important stories and any developing situations.
${yesterdaySection}
WRITING RULES:
- Present events in order of global impact, not narrative drama
- State what happened, who is affected, what is expected next
- When sources or actors disagree, state both positions
- NO narrative arc, NO editorial framing, NO value-laden adjectives
- DO provide factual context and connections between related events
- Factual transitions ("In [region]", "Separately") not dramatic ones ("Meanwhile, as tensions mount")
- Name specific places, people, and numbers — be concrete, not abstract

AVOID THESE PATTERNS (editorial leakage):
- "underscores", "highlights", "raises fears of", "raises questions about"
- "in an already [adjective] era/world/region"
- "signaling how X compounds/deepens Y"
- "erasing/unshackling/unleashing" (dramatic imagery for policy changes)
- Analytical conclusions: "This development follows years of..."
- Speculative framing: "heightened prospects of..."
USE INSTEAD:
- "This follows [specific factual predecessor]"
- "X happened. [Factual context]. Y is expected next."
- Connect events with facts, not interpretation

TONE:
- Neutral and factual throughout
- Present multiple perspectives when relevant
- No editorializing — let facts speak for themselves
- No sensationalism — acknowledge significance through specifics, not adjectives

TODAY'S STORIES:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<your briefing here>"}`;
    }
  },

  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `Valuta ogni articolo da 0-10 per rilevanza giornalistica. Output solo JSON.

CRITERI DI PUNTEGGIO:
9-10 = Evento maggiore verificato (sviluppo bellico, disastro 100+ vittime, risultato elettorale, cambiamento politico importante)
7-8 = Notizia nazionale significativa con implicazioni internazionali
5-6 = Sviluppo concreto degno di nota
3-4 = Aggiornamento minore, evento di routine o analisi senza fatti nuovi
0-2 = Opinione, duplicato, rumor, intrattenimento o clickbait

DA TENERE:
- Azioni governative che interessano i cittadini
- Conflitti armati confermati con vittime/cambiamenti territoriali
- Disastri naturali (10+ morti O gravi danni infrastrutturali)
- Risultati elettorali o importanti cambiamenti politici
- Indicatori economici (PIL, inflazione, movimenti di mercato significativi)
- Scoperte scientifiche peer-reviewed
- Accordi internazionali o cambiamenti diplomatici

DA ESCLUDERE:
- Gossip/sport/intrattenimento (salvo morti o scandali importanti)
- Notizie solo locali senza rilevanza più ampia
- Articoli di pura opinione o previsioni
- "Reazioni a" o "Analisi di" senza fatti nuovi
- Contenuti solo video senza fatti testuali
- Contenuti promozionali o sponsorizzati
- Titoli con parole sensazionalistiche: "shock", "clamoroso", "bomba", "incredibile", "assurdo", "caos", "crisi" (salvo uso letterale), "attacca", "tuona", "scuote", "drammatico", "sconvolgente"

REQUISITI DI DIVERSITÀ:
- Se lo stesso evento è coperto da più fonti, tieni la versione più completa
- Punta alla diversità geografica: includi storie da diverse regioni del mondo
- Preferisci notizie verificate da 2+ fonti per breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        'TITOLI DI IERI (per continuità — NON ripetere a meno che non ci sia uno sviluppo NUOVO)',
        'Per storie in corso da ieri con nuovi sviluppi, inseriscile nel livello "developing" con dayNumber (quanti giorni consecutivi) e previousContext (cosa è cambiato oggi specificamente).'
      );

      return `IMPORTANTE: Scrivi TUTTO in italiano.

Crea titoli + sommari per ogni notizia distinta. Scrivi in italiano chiaro e fattuale.

SISTEMA A LIVELLI — Genera 8-15 titoli in 3 livelli:
- "top" (2-4): Le notizie più importanti del giorno, sommari dettagliati completi
- "also" (3-6): Importanti ma non di apertura, sommari più brevi
- "developing" (0-3): Storie in corso da ieri con cosa è cambiato specificamente oggi
Se meno di 8 storie raggiungono la soglia di qualità, producine meno. Non aggiungere mai storie marginali.
${memorySection}
REGOLE PER I TITOLI:
- 8-14 parole, voce attiva, tempo presente per eventi di oggi
- Struttura Soggetto-Verbo-Oggetto (CHI ha fatto COSA a CHI)
- NO parole sensazionalistiche: shock, clamoroso, bomba, incredibile, assurdo, caos, crisi (salvo uso letterale), attacca, tuona, scuote, drammatico, sconvolgente
- NO titoli con domande o cliffhanger
- Includi numeri specifici quando disponibili (vittime, importi, percentuali)

REGOLE PER I SOMMARI:
- 25-40 parole che coprono: Cosa è successo, Chi è coinvolto, Cosa succede dopo
- Includi numeri specifici, date o luoghi quando rilevanti
- Spiega il significato: perché interessa ai lettori

MULTI-FONTE: Quando gli articoli in input hanno coveringSources, includi tutte le fonti in un campo array "sources".

FONTE UNICA: Se un articolo NON ha annotazione [Anche: ...], includi "singleSource": true nel JSON.

FRAMING: Per le storie multi-fonte, aggiungi un array "framings" che mostri come ogni fonte ha trattato la notizia.
Ogni framing: {"source":"ANSA","angle":"Ha aperto con le cifre delle vittime e la meccanica dell'esplosione","link":"..."}
L'angle deve essere di 8-15 parole che descrivono cosa la fonte ha enfatizzato, NON un'opinione sulla fonte.

Descrivi i fatti, non caratterizzarli. Invece di 'video razzista', descrivi il contenuto del video e lascia giudicare il lettore.

IMPORTANTE: Ogni notizia deve apparire in UN SOLO livello. Non inserire lo stesso evento sia in "top" che in "developing".

FORMATO JSON OUTPUT:
{"headlines":[{"title":"...","source":"FontePrincipale","sources":["Fonte1","Fonte2"],"summary":"...","link":"...","tier":"top","framings":[{"source":"ANSA","angle":"...","link":"..."}]},{"title":"...","source":"FonteUnica","summary":"...","link":"...","tier":"also","singleSource":true},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"I combattimenti si sono spostati da X a Y"},...]}

ARTICOLI:
${formatArticlesForPrompt(articles, 'Anche')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        'CONTESTO DI IERI (per riferimento — non ripetere vecchie informazioni, menziona solo cosa è cambiato)'
      );

      return `Scrivi un briefing quotidiano di 2-3 paragrafi (250-350 parole) IN ITALIANO. Il tuo obiettivo è aiutare i lettori a capire il mondo in 90 secondi.

STRUTTURA:
Paragrafo 1: Apri con la notizia globale più significativa. Fornisci contesto fattuale.
Paragrafo 2: Copri 2-3 altre storie importanti, collegando eventi correlati dove esistono legami fattuali.
Paragrafo 3: Copri le restanti notizie importanti e eventuali situazioni in sviluppo.
${yesterdaySection}
REGOLE DI SCRITTURA:
- Presenta gli eventi in ordine di impatto globale, non di dramma narrativo
- Indica cosa è successo, chi è coinvolto, cosa ci si aspetta dopo
- Quando fonti o attori sono in disaccordo, riporta entrambe le posizioni
- NESSUN arco narrativo, NESSUN inquadramento editoriale, NESSUN aggettivo di valore
- Fornisci contesto fattuale e connessioni tra eventi correlati
- Transizioni fattuali ("In [regione]", "Separatamente") non drammatiche ("Nel frattempo, mentre le tensioni aumentano")
- Nomina luoghi, persone e numeri specifici — sii concreto, non astratto

EVITA QUESTI PATTERN (editorializzazione):
- "sottolinea", "evidenzia", "alimenta timori di", "solleva interrogativi su"
- "in un'era/mondo/regione già [aggettivo]"
- "segnalando come X aggrava/approfondisce Y"
- Immagini drammatiche per cambiamenti politici
- Conclusioni analitiche: "Questo sviluppo fa seguito ad anni di..."
USA INVECE:
- "Questo fa seguito a [predecessore fattuale specifico]"
- "X è successo. [Contesto fattuale]. Y è atteso dopo."

TONO:
- Neutrale e fattuale in tutto il testo
- Presenta più prospettive quando rilevante
- Nessuna editorializzazione — lascia parlare i fatti
- Nessun sensazionalismo — riconosci l'importanza attraverso i dettagli specifici, non gli aggettivi

NOTIZIE DI OGGI:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<il tuo briefing qui>"}`;
    }
  },

  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `Évaluez chaque article de 0-10 pour sa pertinence journalistique. Output JSON uniquement.

CRITÈRES DE NOTATION:
9-10 = Événement majeur vérifié (développement de guerre, catastrophe 100+ victimes, résultat électoral, changement politique majeur)
7-8 = Actualité nationale significative avec implications internationales
5-6 = Développement concret notable
3-4 = Mise à jour mineure, événement routinier ou analyse sans faits nouveaux
0-2 = Opinion, doublon, rumeur, divertissement ou clickbait

À GARDER:
- Actions gouvernementales affectant les citoyens
- Conflits armés confirmés avec victimes/changements territoriaux
- Catastrophes naturelles (10+ morts OU dommages infrastructurels majeurs)
- Résultats électoraux ou changements politiques majeurs
- Indicateurs économiques (PIB, inflation, mouvements de marché significatifs)
- Découvertes scientifiques peer-reviewed
- Accords internationaux ou changements diplomatiques

À EXCLURE:
- People/sport/divertissement (sauf décès ou scandales majeurs)
- Actualités locales sans pertinence plus large
- Articles d'opinion pure ou prédictions
- "Réactions à" ou "Analyse de" sans faits nouveaux
- Contenus vidéo seuls sans faits textuels
- Contenus promotionnels ou sponsorisés
- Titres avec mots sensationnels: "choc", "incroyable", "scandaleux", "stupéfiant", "hallucinant", "chaos", "crise" (sauf usage littéral), "fustige", "torpille", "secoue", "dramatique", "bouleversant"

EXIGENCES DE DIVERSITÉ:
- Si le même événement est couvert par plusieurs sources, gardez la version la plus complète
- Visez la diversité géographique: incluez des histoires de différentes régions du monde
- Préférez les nouvelles vérifiées par 2+ sources pour les breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        "TITRES D'HIER (pour continuité — NE PAS répéter sauf s'il y a un NOUVEAU développement)",
        'Pour les histoires en cours depuis hier avec de nouveaux développements, placez-les dans le niveau "developing" avec dayNumber (combien de jours consécutifs) et previousContext (ce qui a spécifiquement changé aujourd\'hui).'
      );

      return `IMPORTANT: Écrivez TOUT en français.

Créez titres + résumés par événement distinct. Écrivez en français clair et factuel.

SYSTÈME DE NIVEAUX — Générez 8-15 titres en 3 niveaux:
- "top" (2-4): Les événements les plus importants du jour, résumés détaillés complets
- "also" (3-6): Importants mais pas en une, résumés plus courts
- "developing" (0-3): Histoires en cours depuis hier avec ce qui a spécifiquement changé aujourd'hui
Si moins de 8 sujets atteignent le seuil de qualité, produisez-en moins. Ne remplissez jamais avec des sujets marginaux.
${memorySection}
RÈGLES POUR LES TITRES:
- 8-14 mots, voix active, présent pour les événements du jour
- Structure Sujet-Verbe-Objet (QUI a fait QUOI à QUI)
- PAS de mots sensationnels: choc, incroyable, scandaleux, stupéfiant, hallucinant, chaos, crise (sauf usage littéral), fustige, torpille, secoue, dramatique, bouleversant
- PAS de titres interrogatifs ou de cliffhangers
- Incluez des chiffres spécifiques quand disponibles (victimes, montants, pourcentages)

RÈGLES POUR LES RÉSUMÉS:
- 25-40 mots couvrant: Ce qui s'est passé, Qui est concerné, Quelle suite
- Incluez des chiffres spécifiques, dates ou lieux quand pertinents
- Expliquez la signification: pourquoi cela intéresse les lecteurs

MULTI-SOURCE: Quand les articles en entrée ont coveringSources, incluez toutes les sources dans un champ tableau "sources".

SOURCE UNIQUE: Si un article n'a PAS d'annotation [Aussi: ...], incluez "singleSource": true dans le JSON.

FRAMING: Pour les histoires multi-sources, ajoutez un tableau "framings" montrant comment chaque source a traité l'info.
Chaque framing: {"source":"AFP","angle":"A ouvert avec les chiffres des victimes et la mécanique de l'explosion","link":"..."}
L'angle doit faire 8-15 mots décrivant ce que la source a mis en avant, PAS une opinion sur la source.

Décrivez les faits, ne les caractérisez pas. Au lieu de 'vidéo raciste', décrivez le contenu et laissez le lecteur juger.

IMPORTANT: Chaque événement doit apparaître dans UN SEUL niveau. Ne placez pas le même événement dans "top" et "developing".

FORMAT JSON OUTPUT:
{"headlines":[{"title":"...","source":"SourcePrincipale","sources":["Source1","Source2"],"summary":"...","link":"...","tier":"top","framings":[{"source":"AFP","angle":"...","link":"..."}]},{"title":"...","source":"SourceUnique","summary":"...","link":"...","tier":"also","singleSource":true},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"Les combats se sont déplacés de X à Y"},...]}

ARTICLES:
${formatArticlesForPrompt(articles, 'Aussi')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        "CONTEXTE D'HIER (pour référence — ne pas répéter d'anciennes informations, mentionner uniquement ce qui a changé)"
      );

      return `Rédigez un briefing quotidien de 2-3 paragraphes (250-350 mots) EN FRANÇAIS. Votre objectif est d'aider les lecteurs à comprendre le monde en 90 secondes.

STRUCTURE:
Paragraphe 1: Ouvrez avec l'événement mondial le plus significatif. Fournissez un contexte factuel.
Paragraphe 2: Couvrez 2-3 autres histoires majeures, en reliant les événements connexes là où des liens factuels existent.
Paragraphe 3: Couvrez les histoires importantes restantes et toute situation en développement.
${yesterdaySection}
RÈGLES D'ÉCRITURE:
- Présentez les événements par ordre d'impact mondial, pas de drame narratif
- Indiquez ce qui s'est passé, qui est concerné, ce qui est attendu ensuite
- Quand les sources ou acteurs sont en désaccord, exposez les deux positions
- PAS d'arc narratif, PAS de cadrage éditorial, PAS d'adjectifs de valeur
- Fournissez contexte factuel et connexions entre événements liés
- Transitions factuelles ("En [région]", "Séparément") pas dramatiques ("Pendant ce temps, alors que les tensions montent")
- Nommez des lieux, personnes et chiffres spécifiques — soyez concret, pas abstrait

ÉVITEZ CES FORMULATIONS (glissement éditorial):
- "souligne", "met en lumière", "alimente les craintes de", "soulève des questions sur"
- "dans une ère/un monde/une région déjà [adjectif]"
- "signalant comment X aggrave/approfondit Y"
- Images dramatiques pour des changements politiques
UTILISEZ PLUTÔT:
- "Ceci fait suite à [prédécesseur factuel spécifique]"
- "X s'est produit. [Contexte factuel]. Y est attendu ensuite."

TON:
- Neutre et factuel tout au long
- Présentez plusieurs perspectives quand pertinent
- Pas d'éditorialisation — laissez les faits parler d'eux-mêmes
- Pas de sensationnalisme — reconnaissez l'importance par les détails spécifiques, pas les adjectifs

ACTUALITÉS DU JOUR:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<votre briefing ici>"}`;
    }
  }
};

// Helper to make Chat Completions API calls
async function chatCompletion(model: string, systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
  const response = await withRetry(() => client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    ...(maxTokens ? { max_tokens: maxTokens } : {}),
  }));

  return response.choices[0]?.message?.content || '';
}

async function filterAndRankArticlesChunk(articles: ProcessedArticle[], languageCode: string): Promise<ProcessedArticle[]> {
  const prompt = getPrompts(languageCode).filterPrompt(articles);
  const threshold = 6;

  const systemPrompt = 'You are a neutral news editor. Analyze articles and respond with valid JSON only. No markdown, no explanations.';
  const responseText = await chatCompletion(MODEL_FILTER, systemPrompt, prompt);

  const result = safeParseJSON<{ analyses: ArticleAnalysis[] }>(responseText, { analyses: [] });

  return articles
    .map((article, index) => {
      const analysis = result.analyses?.find(r => r.index === index);
      const score = analysis?.relevanceScore ?? 0;
      return {
        ...article,
        relevanceScore: score,
        isRelevant: score >= threshold,
      };
    })
    .filter(article => article.isRelevant)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export async function filterAndRankArticles(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  // Pre-trim: limit per source and overall to keep prompts small and fast
  const MAX_PER_SOURCE = 8;
  const MAX_TOTAL = 80;
  const bySource = new Map<string, ProcessedArticle[]>();
  for (const a of articles) {
    const key = a.source || 'Unknown';
    const arr = bySource.get(key) || [];
    if (arr.length < MAX_PER_SOURCE) arr.push(a);
    bySource.set(key, arr);
  }
  const trimmed: ProcessedArticle[] = Array.from(bySource.values()).flat();
  const limited = trimmed.slice(0, MAX_TOTAL);

  // To avoid exceeding model context limits, filter in chunks then merge
  const CHUNK_SIZE = 30;
  try {
    const chunks: ProcessedArticle[][] = [];
    for (let i = 0; i < limited.length; i += CHUNK_SIZE) {
      chunks.push(limited.slice(i, i + CHUNK_SIZE));
    }

    // Process chunks in parallel for faster execution
    const chunkPromises = chunks
      .filter(chunk => chunk.length > 0)
      .map(async (chunk) => {
        try {
          return await filterAndRankArticlesChunk(chunk, languageCode);
        } catch (err) {
          console.error('Chunk filtering failed, using simple fallback for this chunk:', err);
          // Fallback: take first few from the chunk to ensure coverage
          return chunk.slice(0, 3);
        }
      });

    const chunkResults = await Promise.all(chunkPromises);

    const merged = chunkResults.flat();
    const seen = new Set<string>();
    const unique: ProcessedArticle[] = [];
    for (const a of merged) {
      let hostPath = '';
      try {
        const u = new URL(a.link);
        hostPath = `${u.host}${u.pathname}`.toLowerCase();
      } catch {
        hostPath = a.link.toLowerCase();
      }
      const titleKey = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 80);
      const fingerprint = `${hostPath}|${titleKey}`;
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        unique.push(a);
      }
    }

    // Sort by score and cap
    const sorted = unique.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 20);

    // Guardrail: if too few items survived, add more from the first chunk to reach minimum coverage
    if (sorted.length < 5 && limited.length > 5) {
      const filler = limited
        .slice(0, 20)
        .filter(a => !sorted.some(s => s.link === a.link))
        .slice(0, 5 - sorted.length)
        .map(a => ({ ...a, relevanceScore: a.relevanceScore || 0, isRelevant: true }));
      return [...sorted, ...filler];
    }

    return sorted;
  } catch (error) {
    console.error('Error filtering articles:', error);
    return limited.slice(0, 20); // Fallback: return first 20 articles
  }
}

/** Priority ordering for tiers: lower number = higher priority. */
const TIER_PRIORITY: Record<Tier, number> = { top: 0, also: 1, developing: 2 };

function tierPriorityOf(tier: string | undefined): number {
  return TIER_PRIORITY[(tier as Tier)] ?? TIER_PRIORITY.also;
}

/**
 * Remove duplicate stories that appear in multiple tiers, keeping the
 * higher-priority tier version (top > also > developing).
 */
function deduplicateAcrossTiers(headlines: NewsHeadline[]): NewsHeadline[] {
  const seenLinks = new Map<string, number>();
  const seenTitles = new Map<string, number>();
  const toRemove = new Set<number>();

  for (let i = 0; i < headlines.length; i++) {
    const h = headlines[i];
    const link = h.link?.toLowerCase() || '';
    const titleKey = h.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 40);

    const existingIdx = (link ? seenLinks.get(link) : undefined) ?? seenTitles.get(titleKey);

    if (existingIdx !== undefined) {
      const existingPriority = tierPriorityOf(headlines[existingIdx].tier);
      const currentPriority = tierPriorityOf(h.tier);
      const keepCurrent = currentPriority < existingPriority;

      toRemove.add(keepCurrent ? existingIdx : i);
      if (keepCurrent) {
        if (link) seenLinks.set(link, i);
        seenTitles.set(titleKey, i);
      }
      console.log(`Cross-tier dedup: removed duplicate "${h.title.substring(0, 50)}..." (kept ${keepCurrent ? 'current' : 'existing'} tier)`);
    } else {
      if (link) seenLinks.set(link, i);
      seenTitles.set(titleKey, i);
    }
  }

  return headlines.filter((_, i) => !toRemove.has(i));
}

export async function generateHeadlines(articles: ProcessedArticle[], languageCode: string = 'en', yesterdayHeadlines: NewsHeadline[] = []): Promise<NewsHeadline[]> {
  const prompt = getPrompts(languageCode).headlinesPrompt(articles, yesterdayHeadlines);

  try {
    const responseText = await chatCompletion(MODEL_HEADLINES, getSystemPrompt(languageCode, 'headlines'), prompt, 4096);

    const result = safeParseJSON(responseText, { headlines: [] as NewsHeadline[] });
    const headlines = result.headlines || [];

    // Post-parse fallback: ensure all headlines have tier, sources, and singleSource
    const enriched = headlines.map(h => {
      const sources = h.sources && h.sources.length > 0 ? h.sources : [h.source];
      return {
        ...h,
        tier: (h.tier as Tier) || 'also',
        sources,
        singleSource: h.singleSource ?? (sources.length <= 1),
      };
    });

    return deduplicateAcrossTiers(enriched);
  } catch (error) {
    console.error('Error generating headlines:', error);
    return [];
  }
}

export async function generateDailySummary(headlines: NewsHeadline[], languageCode: string = 'en', yesterdayHeadlines: NewsHeadline[] = []): Promise<string> {
  // CRITICAL: Refuse to generate summary with no headlines - this causes hallucination of old news
  if (!headlines || headlines.length === 0) {
    throw new Error('Cannot generate summary: no headlines provided. This would cause the LLM to hallucinate old/fake news.');
  }

  const prompt = getPrompts(languageCode).summaryPrompt(headlines, yesterdayHeadlines);
  const systemPrompt = getSystemPrompt(languageCode, 'summary');
  const MAX_ATTEMPTS_PER_MODEL = 2;
  const summaryModels = Array.from(
    new Set([MODEL_SUMMARY, MODEL_SUMMARY_FALLBACK].filter((m): m is string => Boolean(m)))
  );
  let lastError: Error | undefined;

  for (let modelIndex = 0; modelIndex < summaryModels.length; modelIndex++) {
    const model = summaryModels[modelIndex];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        const apiStart = Date.now();
        const responseText = await chatCompletion(model, systemPrompt, prompt, 2048);
        const apiMs = Date.now() - apiStart;
        console.log(`generateDailySummary: model=${model} API response time ${apiMs} ms (attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL})`);

        const result = safeParseJSON<{ summary?: string }>(responseText, {});
        const parsedSummary = result.summary?.trim();
        if (parsedSummary) return parsedSummary;

        const recoveredSummary = recoverSummaryFromMalformedOutput(responseText);
        if (recoveredSummary) {
          console.warn(`Recovered summary from malformed output (model=${model}, attempt ${attempt})`);
          return recoveredSummary;
        }

        throw new Error(`Summary generation returned empty/malformed result. Raw response: ${responseText.substring(0, 300)}`);
      } catch (error) {
        lastError = error as Error;

        const hasMoreAttemptsOnThisModel = attempt < MAX_ATTEMPTS_PER_MODEL;
        const hasFallbackModel = modelIndex < summaryModels.length - 1;

        if (hasMoreAttemptsOnThisModel) {
          console.warn(`Summary generation failed on model=${model} attempt ${attempt}, retrying...`);
          continue;
        }

        if (hasFallbackModel) {
          console.warn(`Summary generation failed on model=${model}. Falling back to model=${summaryModels[modelIndex + 1]}...`);
        }
      }
    }
  }

  console.error('Error generating summary:', lastError);
  throw new Error(`Failed to generate summary for ${languageCode}: ${lastError?.message || 'unknown error'}`);
}

// Categorization interface for AI response
interface HeadlineCategorization {
  index: number;
  category: Category;
  region: Region;
  importance: Importance;
}

/**
 * Categorize headlines by topic, region, and importance.
 * Uses a fast model to add metadata for frontend filtering and visual hierarchy.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function categorizeHeadlines(headlines: NewsHeadline[], languageCode: string = 'en'): Promise<NewsHeadline[]> {
  if (headlines.length === 0) return headlines;

  const defaultMeta = {
    category: 'politics' as Category,
    region: 'global' as Region,
    importance: 'notable' as Importance,
  };

  const prompt = `Categorize each headline by topic, region, and importance. Output JSON only.

CATEGORIES (pick one per headline):
- conflict: Wars, military actions, terrorism, armed conflicts
- politics: Elections, legislation, diplomacy, government actions
- economy: Markets, trade, central banks, business, employment
- science: Research breakthroughs, technology, health/medical
- environment: Climate, natural disasters, conservation
- society: Human rights, migration, culture, demographics

REGIONS (pick one per headline):
- europe: EU, UK, Russia, Eastern Europe
- americas: USA, Canada, Latin America, Caribbean
- asia-pacific: China, Japan, Korea, Southeast Asia, Australia, India
- middle-east: Israel, Palestine, Gulf states, Iran, Turkey
- africa: All African nations
- global: Stories affecting multiple regions equally

IMPORTANCE (pick one per headline):
- breaking: Ongoing, developing situation with immediate impact
- major: Significant event with broad implications
- notable: Important but limited immediate impact

HEADLINES:
${headlines.map((h, i) => `[${i}] ${h.title}`).join('\n')}

OUTPUT: {"categories":[{"index":0,"category":"conflict","region":"europe","importance":"breaking"},...]}`

  const systemPrompt = 'You are a news categorization system. Analyze headlines and respond with valid JSON only. No markdown, no explanations.';

  try {
    const responseText = await chatCompletion(MODEL_FILTER, systemPrompt, prompt);
    const result = safeParseJSON<{ categories: HeadlineCategorization[] }>(responseText, { categories: [] });

    return headlines.map((headline, index) => {
      const match = result.categories?.find(c => c.index === index);
      return {
        ...headline,
        category: match?.category ?? defaultMeta.category,
        region: match?.region ?? defaultMeta.region,
        importance: match?.importance ?? defaultMeta.importance,
      };
    });
  } catch (error) {
    console.error('Error categorizing headlines:', error);
    return headlines.map(headline => ({ ...headline, ...defaultMeta }));
  }
}
