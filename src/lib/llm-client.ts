import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline } from '@/types/news';

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
    // Try to extract JSON from code fences or stray text
    const fenceMatch = text.match(/```(?:json)?\n([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1] : (() => {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
      return '';
    })();
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

SCORING:
9-10 = Major verified event (war, disaster 100+ deaths, election result, major policy)
7-8 = Significant national news with international relevance
5-6 = Notable concrete development
3-4 = Minor update or analysis
0-2 = Opinion, duplicate, rumor, or entertainment

KEEP: Government actions, confirmed conflicts, natural disasters (10+ casualties), elections, health policy, economics, peer-reviewed science
DROP: Celebrity/sports, local-only, opinion pieces, predictions, "reactions to" articles, video-only without facts

If same event appears twice, mark lower-quality one as duplicate.

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 250)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[]) => `Create one headline + summary per news event. Write in plain English.

HEADLINE: 8-12 words, subject-verb-object, present tense, no hype words (slams/blasts/rocks)
SUMMARY: 20-30 words stating what happened, who's affected, what's next

EXAMPLE:
{"title":"France Raises Retirement Age to 64 Despite Protests","source":"Reuters","summary":"The French parliament approved raising the retirement age from 62 to 64. Unions plan nationwide strikes next week affecting transport and schools.","link":"..."}

OUTPUT JSON: {"headlines":[...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 500)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Write a 2-3 paragraph news briefing (200-280 words) that tells the STORY of today. Connect events, show why they matter, make it engaging to read. Write like The Economist - smart but accessible.

GOOD EXAMPLE:
{"summary":"The war in Ukraine reached Moscow's doorstep today when a car bomb killed a senior Russian general in the capital - a brazen strike that signals Kyiv's growing reach inside Russia. The assassination comes just days after peace talks showed unexpected progress, raising questions about whether hardliners are trying to derail diplomacy before it gains momentum.\\n\\nHalf a world away, millions struggling with obesity got rare good news: the FDA cleared the first pill form of Wegovy, potentially making the blockbuster treatment accessible to those who can't tolerate weekly injections. And in Cuba, the lights went out again - the fourth major blackout in months left 10 million people in Havana and western provinces without power, a stark reminder of how sanctions and aging infrastructure have brought the island's grid to its knees."}

BAD (don't do this): "Russia attacked Ukraine. A general was killed. The FDA approved a drug. Cuba had a blackout." - This is just a list, not a story.

TODAY'S STORIES:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<your briefing here>"}`
  },

  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `Valuta ogni articolo da 0-10 per rilevanza giornalistica. Output solo JSON.

PUNTEGGI:
9-10 = Evento maggiore verificato (guerra, disastro 100+ morti, risultato elettorale, politica importante)
7-8 = Notizia nazionale significativa con rilevanza internazionale
5-6 = Sviluppo concreto notevole
3-4 = Aggiornamento minore o analisi
0-2 = Opinione, duplicato, rumor, o intrattenimento

TIENI: Azioni governative, conflitti confermati, disastri naturali (10+ vittime), elezioni, sanità, economia, scienza peer-reviewed
ESCLUDI: Gossip/sport, solo locale, opinioni, previsioni, "reazioni a", solo video senza fatti

Se lo stesso evento appare due volte, segna quello di qualità inferiore come duplicato.

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 250)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[]) => `IMPORTANTE: Scrivi TUTTO in italiano.

Crea un titolo + sommario per ogni notizia. Scrivi in italiano semplice e chiaro.

TITOLO: 8-12 parole, soggetto-verbo-oggetto, tempo presente, niente parole sensazionalistiche
SOMMARIO: 20-30 parole che spiegano cosa è successo, chi è coinvolto, cosa succede dopo

ESEMPIO:
{"title":"La Francia alza l'età pensionabile a 64 anni nonostante le proteste","source":"Reuters","summary":"Il parlamento francese ha approvato l'innalzamento dell'età pensionabile da 62 a 64 anni. I sindacati pianificano scioperi nazionali la prossima settimana.","link":"..."}

OUTPUT JSON: {"headlines":[...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 500)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Scrivi un briefing di 2-3 paragrafi (200-280 parole) IN ITALIANO che racconti la STORIA di oggi. Collega gli eventi, mostra perché contano, rendilo coinvolgente. Scrivi come un giornalista esperto.

BUON ESEMPIO:
{"summary":"La guerra in Ucraina ha raggiunto Mosca oggi quando un'autobomba ha ucciso un generale russo nel cuore della capitale - un attacco audace che segnala la crescente capacità di Kiev di colpire in profondità in Russia. L'assassinio arriva pochi giorni dopo che i colloqui di pace avevano mostrato progressi inaspettati, sollevando interrogativi su chi stia cercando di far deragliare la diplomazia.\\n\\nDall'altra parte del mondo, milioni di persone alle prese con l'obesità hanno ricevuto una rara buona notizia: la FDA ha approvato la prima pillola di Wegovy. E a Cuba, le luci si sono spente di nuovo - il quarto grande blackout in pochi mesi ha lasciato 10 milioni di persone all'Avana senza corrente, un duro promemoria di come sanzioni e infrastrutture fatiscenti abbiano messo in ginocchio la rete elettrica dell'isola."}

MALE (non fare così): "La Russia ha attaccato l'Ucraina. Un generale è stato ucciso. La FDA ha approvato un farmaco." - Questa è solo una lista, non una storia.

NOTIZIE DI OGGI:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<il tuo briefing qui>"}`
  },

  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `Évaluez chaque article de 0-10 pour sa pertinence journalistique. Output JSON uniquement.

NOTATION:
9-10 = Événement majeur vérifié (guerre, catastrophe 100+ morts, résultat électoral, politique majeure)
7-8 = Actualité nationale significative avec pertinence internationale
5-6 = Développement concret notable
3-4 = Mise à jour mineure ou analyse
0-2 = Opinion, doublon, rumeur, ou divertissement

GARDER: Actions gouvernementales, conflits confirmés, catastrophes naturelles (10+ victimes), élections, santé, économie, science peer-reviewed
EXCLURE: People/sport, local uniquement, opinions, prédictions, "réactions à", vidéo seule sans faits

Si le même événement apparaît deux fois, marquez celui de moindre qualité comme doublon.

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 250)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[]) => `IMPORTANT: Écrivez TOUT en français.

Créez un titre + résumé par événement. Écrivez en français simple et clair.

TITRE: 8-12 mots, sujet-verbe-objet, présent, pas de mots sensationnels
RÉSUMÉ: 20-30 mots expliquant ce qui s'est passé, qui est concerné, quelle suite

EXEMPLE:
{"title":"La France relève l'âge de la retraite à 64 ans malgré les manifestations","source":"Reuters","summary":"Le parlement français a approuvé le relèvement de l'âge de la retraite de 62 à 64 ans. Les syndicats prévoient des grèves nationales la semaine prochaine.","link":"..."}

OUTPUT JSON: {"headlines":[...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 500)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Rédigez un briefing de 2-3 paragraphes (200-280 mots) EN FRANÇAIS qui raconte l'HISTOIRE de la journée. Connectez les événements, montrez pourquoi ils comptent, rendez-le captivant. Écrivez comme un journaliste chevronné.

BON EXEMPLE:
{"summary":"La guerre en Ukraine a atteint Moscou aujourd'hui quand une voiture piégée a tué un général russe au cœur de la capitale - une frappe audacieuse qui signale la capacité croissante de Kiev à frapper en profondeur en Russie. L'assassinat survient quelques jours après que les pourparlers de paix ont montré des progrès inattendus, soulevant des questions sur qui cherche à faire dérailler la diplomatie.\\n\\nÀ l'autre bout du monde, des millions de personnes luttant contre l'obésité ont reçu une rare bonne nouvelle: la FDA a approuvé la première pilule Wegovy. Et à Cuba, les lumières se sont éteintes à nouveau - la quatrième grande panne en quelques mois a plongé 10 millions d'habitants de La Havane dans le noir, un rappel brutal de la façon dont les sanctions et les infrastructures vieillissantes ont mis le réseau de l'île à genoux."}

MAUVAIS (ne faites pas ça): "La Russie a attaqué l'Ukraine. Un général a été tué. La FDA a approuvé un médicament." - C'est juste une liste, pas une histoire.

ACTUALITÉS DU JOUR:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<votre briefing ici>"}`
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

    const chunkResults: ProcessedArticle[][] = [];
    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      try {
        const res = await filterAndRankArticlesChunk(chunk, languageCode);
        chunkResults.push(res);
      } catch (err) {
        console.error('Chunk filtering failed, using simple fallback for this chunk:', err);
        // Fallback: take first few from the chunk to ensure coverage
        chunkResults.push(chunk.slice(0, 3));
      }
    }

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
    const sorted = unique.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);

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
    return limited.slice(0, 10); // Fallback: return first 10 articles
  }
}

export async function generateHeadlines(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<NewsHeadline[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.headlinesPrompt(articles);

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
    return result.headlines || [];
  } catch (error) {
    console.error('Error generating headlines:', error);
    // Fallback: create basic headlines from articles
    return articles.map(article => ({
      title: article.title,
      source: article.source,
      summary: article.content.substring(0, 200) + '...',
      link: article.link,
    }));
  }
}

export async function generateDailySummary(headlines: NewsHeadline[], languageCode: string = 'en'): Promise<string> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.summaryPrompt(headlines);

  const fallbackSummary = languageCode === 'it'
    ? 'I mercati globali e gli affari internazionali hanno continuato la loro progressione costante oggi, con vari sviluppi nei settori economico, politico e sociale. Nel frattempo, gli indicatori chiave suggeriscono una stabilita continua nella maggior parte delle regioni, mentre le istituzioni di tutto il mondo coordinano le risposte alle sfide emergenti.\n\nQuesti sviluppi riflettono un modello piu ampio di cooperazione internazionale e resilienza economica. Mentre governi e organizzazioni navigano dinamiche globali complesse, il loro approccio coordinato dimostra un impegno a mantenere la stabilita affrontando al contempo iniziative strategiche a lungo termine attraverso canali diplomatici ed economici consolidati.'
    : languageCode === 'fr'
    ? 'Les marches mondiaux et les affaires internationales ont poursuivi leur progression constante aujourd\'hui, avec divers developpements dans les secteurs economique, politique et social. Parallelement, les indicateurs cles suggerent une stabilite continue dans la plupart des regions, tandis que les institutions du monde entier coordonnent leurs reponses aux defis emergents.\n\nCes developpements refletent un modele plus large de cooperation internationale et de resilience economique. Alors que les gouvernements et les organisations naviguent dans des dynamiques mondiales complexes, leur approche coordonnee demontre un engagement a maintenir la stabilite tout en abordant des initiatives strategiques a long terme a travers des canaux diplomatiques et economiques etablis.'
    : 'Global markets and international affairs continued their steady progression today, with various developments across economic, political, and social sectors. Meanwhile, key indicators suggest ongoing stability in most regions, as institutions worldwide coordinate responses to emerging challenges.\n\nThese developments reflect a broader pattern of international cooperation and economic resilience. As governments and organizations navigate complex global dynamics, their coordinated approach demonstrates a commitment to maintaining stability while addressing long-term strategic initiatives through established diplomatic and economic channels.';

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

    const result = safeParseJSON(responseText, { summary: fallbackSummary });
    return result.summary || fallbackSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return fallbackSummary;
  }
}
