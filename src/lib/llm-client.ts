import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline, Category, Region, Importance, Tier } from '@/types/news';

// OpenRouter client configuration
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

function safeParseJSON<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try to extract JSON from code fences or raw braces
    const fenceMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
    let candidate = fenceMatch?.[1] ?? '';

    if (!candidate) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        candidate = text.slice(start, end + 1);
      }
    }

    if (candidate) {
      try { return JSON.parse(candidate) as T; } catch { /* ignore */ }
    }
    return fallback;
  }
}

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

// =============================================================================
// NEW SIMPLIFIED PROMPTS - Designed for clarity, language enforcement, and quality
// =============================================================================

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
      const memorySection = yesterdayHeadlines.length > 0 ? `
YESTERDAY'S HEADLINES (for continuity — do NOT repeat unless there is a NEW development):
${yesterdayHeadlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}
For ongoing stories from yesterday with new developments, place them in the "developing" tier with dayNumber (how many consecutive days) and previousContext (what specifically changed today).

` : '';

      return `Create headlines + summaries for distinct news events. Write in clear, factual English.

TIER SYSTEM — Generate 12-15 headlines in 3 tiers:
- "top" (3-4): Day's most important events, full detailed summaries
- "also" (5-6): Important but not lead stories, shorter summaries
- "developing" (2-3): Ongoing stories from yesterday with what specifically changed today
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

OUTPUT JSON FORMAT:
{"headlines":[{"title":"...","source":"PrimarySource","sources":["Source1","Source2"],"summary":"...","link":"...","tier":"top"},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"Fighting shifted from X to Y"},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}${a.coveringSources ? ` [Also: ${a.coveringSources.join(', ')}]` : ''}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = yesterdayHeadlines.length > 0 ? `
YESTERDAY'S CONTEXT (for reference — do not repeat old information, only mention what changed):
${yesterdayHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

` : '';

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
- Titoli con parole sensazionalistiche: "shock", "clamoroso", "bomba"

REQUISITI DI DIVERSITÀ:
- Se lo stesso evento è coperto da più fonti, tieni la versione più completa
- Punta alla diversità geografica: includi storie da diverse regioni del mondo
- Preferisci notizie verificate da 2+ fonti per breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = yesterdayHeadlines.length > 0 ? `
TITOLI DI IERI (per continuità — NON ripetere a meno che non ci sia uno sviluppo NUOVO):
${yesterdayHeadlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}
Per storie in corso da ieri con nuovi sviluppi, inseriscile nel livello "developing" con dayNumber (quanti giorni consecutivi) e previousContext (cosa è cambiato oggi specificamente).

` : '';

      return `IMPORTANTE: Scrivi TUTTO in italiano.

Crea titoli + sommari per ogni notizia distinta. Scrivi in italiano chiaro e fattuale.

SISTEMA A LIVELLI — Genera 12-15 titoli in 3 livelli:
- "top" (3-4): Le notizie più importanti del giorno, sommari dettagliati completi
- "also" (5-6): Importanti ma non di apertura, sommari più brevi
- "developing" (2-3): Storie in corso da ieri con cosa è cambiato specificamente oggi
${memorySection}
REGOLE PER I TITOLI:
- 8-14 parole, voce attiva, tempo presente per eventi di oggi
- Struttura Soggetto-Verbo-Oggetto (CHI ha fatto COSA a CHI)
- NO parole sensazionalistiche: shock, clamoroso, bomba, incredibile, assurdo
- NO titoli con domande o cliffhanger
- Includi numeri specifici quando disponibili (vittime, importi, percentuali)

REGOLE PER I SOMMARI:
- 25-40 parole che coprono: Cosa è successo, Chi è coinvolto, Cosa succede dopo
- Includi numeri specifici, date o luoghi quando rilevanti
- Spiega il significato: perché interessa ai lettori

MULTI-FONTE: Quando gli articoli in input hanno coveringSources, includi tutte le fonti in un campo array "sources".

FORMATO JSON OUTPUT:
{"headlines":[{"title":"...","source":"FontePrincipale","sources":["Fonte1","Fonte2"],"summary":"...","link":"...","tier":"top"},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"I combattimenti si sono spostati da X a Y"},...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}${a.coveringSources ? ` [Anche: ${a.coveringSources.join(', ')}]` : ''}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = yesterdayHeadlines.length > 0 ? `
CONTESTO DI IERI (per riferimento — non ripetere vecchie informazioni, menziona solo cosa è cambiato):
${yesterdayHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

` : '';

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
- Titres avec mots sensationnels: "choc", "incroyable", "scandaleux"

EXIGENCES DE DIVERSITÉ:
- Si le même événement est couvert par plusieurs sources, gardez la version la plus complète
- Visez la diversité géographique: incluez des histoires de différentes régions du monde
- Préférez les nouvelles vérifiées par 2+ sources pour les breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = yesterdayHeadlines.length > 0 ? `
TITRES D'HIER (pour continuité — NE PAS répéter sauf s'il y a un NOUVEAU développement):
${yesterdayHeadlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}
Pour les histoires en cours depuis hier avec de nouveaux développements, placez-les dans le niveau "developing" avec dayNumber (combien de jours consécutifs) et previousContext (ce qui a spécifiquement changé aujourd'hui).

` : '';

      return `IMPORTANT: Écrivez TOUT en français.

Créez titres + résumés par événement distinct. Écrivez en français clair et factuel.

SYSTÈME DE NIVEAUX — Générez 12-15 titres en 3 niveaux:
- "top" (3-4): Les événements les plus importants du jour, résumés détaillés complets
- "also" (5-6): Importants mais pas en une, résumés plus courts
- "developing" (2-3): Histoires en cours depuis hier avec ce qui a spécifiquement changé aujourd'hui
${memorySection}
RÈGLES POUR LES TITRES:
- 8-14 mots, voix active, présent pour les événements du jour
- Structure Sujet-Verbe-Objet (QUI a fait QUOI à QUI)
- PAS de mots sensationnels: choc, incroyable, scandaleux, stupéfiant, hallucinant
- PAS de titres interrogatifs ou de cliffhangers
- Incluez des chiffres spécifiques quand disponibles (victimes, montants, pourcentages)

RÈGLES POUR LES RÉSUMÉS:
- 25-40 mots couvrant: Ce qui s'est passé, Qui est concerné, Quelle suite
- Incluez des chiffres spécifiques, dates ou lieux quand pertinents
- Expliquez la signification: pourquoi cela intéresse les lecteurs

MULTI-SOURCE: Quand les articles en entrée ont coveringSources, incluez toutes les sources dans un champ tableau "sources".

FORMAT JSON OUTPUT:
{"headlines":[{"title":"...","source":"SourcePrincipale","sources":["Source1","Source2"],"summary":"...","link":"...","tier":"top"},{"title":"...","source":"...","summary":"...","link":"...","tier":"developing","dayNumber":3,"previousContext":"Les combats se sont déplacés de X à Y"},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}${a.coveringSources ? ` [Aussi: ${a.coveringSources.join(', ')}]` : ''}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`;
    },

    summaryPrompt: (headlines: NewsHeadline[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = yesterdayHeadlines.length > 0 ? `
CONTEXTE D'HIER (pour référence — ne pas répéter d'anciennes informations, mentionner uniquement ce qui a changé):
${yesterdayHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`).join('\n')}

` : '';

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
async function chatCompletion(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await withRetry(() => client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
  }));

  return response.choices[0]?.message?.content || '';
}

// Internal helper: filter a single chunk of articles via the model
async function filterAndRankArticlesChunk(articles: ProcessedArticle[], languageCode: string): Promise<ProcessedArticle[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.filterPrompt(articles);
  const threshold = (languageCode === 'fr' || languageCode === 'it') ? 5 : 6;

  const systemPrompt = 'You are a neutral news editor. Analyze articles and respond with valid JSON only. No markdown, no explanations.';
  const responseText = await chatCompletion(MODEL_FILTER, systemPrompt, prompt);

  const result = safeParseJSON<{ analyses: ArticleAnalysis[] }>(responseText, { analyses: [] as ArticleAnalysis[] });

  return articles
    .map((article, index) => {
      const analysis: ArticleAnalysis | undefined = result.analyses?.find((r: ArticleAnalysis) => r.index === index);
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

    // Merge and deduplicate by normalized title + link host/path
    const merged = ([] as ProcessedArticle[]).concat(...chunkResults);
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

export async function generateHeadlines(articles: ProcessedArticle[], languageCode: string = 'en', yesterdayHeadlines: NewsHeadline[] = []): Promise<NewsHeadline[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.headlinesPrompt(articles, yesterdayHeadlines);

  // Language-specific system prompts to enforce output language
  const systemPrompts: Record<string, string> = {
    en: 'You are a neutral news editor. Write all headlines and summaries in English. Output valid JSON only.',
    it: 'Sei un redattore neutrale. Scrivi TUTTI i titoli e sommari in ITALIANO. Output solo JSON valido.',
    fr: 'Vous êtes un rédacteur neutre. Écrivez TOUS les titres et résumés en FRANÇAIS. Output JSON valide uniquement.'
  };

  try {
    const systemPrompt = systemPrompts[languageCode] || systemPrompts.en;
    const responseText = await chatCompletion(MODEL_HEADLINES, systemPrompt, prompt);

    const result = safeParseJSON(responseText, { headlines: [] as NewsHeadline[] });
    const headlines = result.headlines || [];

    // Post-parse fallback: ensure all headlines have tier and sources
    return headlines.map(h => ({
      ...h,
      tier: (h.tier as Tier) || 'also',
      sources: h.sources && h.sources.length > 0 ? h.sources : [h.source],
    }));
  } catch (error) {
    console.error('Error generating headlines:', error);
    // Return empty array - the pipeline will handle this as "unavailable"
    return [];
  }
}

export async function generateDailySummary(headlines: NewsHeadline[], languageCode: string = 'en', yesterdayHeadlines: NewsHeadline[] = []): Promise<string> {
  // CRITICAL: Refuse to generate summary with no headlines - this causes hallucination of old news
  if (!headlines || headlines.length === 0) {
    throw new Error('Cannot generate summary: no headlines provided. This would cause the LLM to hallucinate old/fake news.');
  }

  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.summaryPrompt(headlines, yesterdayHeadlines);

  // Language-specific system prompts to enforce output language
  const systemPrompts: Record<string, string> = {
    en: 'You are a neutral news writer. Write the summary in plain English. Output valid JSON only.',
    it: 'Sei un giornalista neutrale. Scrivi il riassunto in ITALIANO semplice e chiaro. Output solo JSON valido.',
    fr: 'Vous êtes un journaliste neutre. Rédigez le résumé en FRANÇAIS simple et clair. Output JSON valide uniquement.'
  };

  try {
    const apiStart = Date.now();
    const systemPrompt = systemPrompts[languageCode] || systemPrompts.en;
    const responseText = await chatCompletion(MODEL_SUMMARY, systemPrompt, prompt);
    const apiMs = Date.now() - apiStart;
    console.log(`generateDailySummary: API response time ${apiMs} ms`);

    const result = safeParseJSON<{ summary?: string }>(responseText, {});

    // CRITICAL: Do not use generic fallback summaries - they mislead users
    // If we can't generate a real summary, throw and let the pipeline handle it
    if (!result.summary || result.summary.trim().length === 0) {
      throw new Error(`Summary generation returned empty result. Raw response: ${responseText.substring(0, 300)}`);
    }

    return result.summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error(`Failed to generate summary for ${languageCode}: ${(error as Error).message}`);
  }
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
      const match = result.categories?.find((c: HeadlineCategorization) => c.index === index);
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
