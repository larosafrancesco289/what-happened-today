import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline } from '@/types/news';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY?.trim(),
  timeout: 90000,
  // Prefer our custom retry logic to control backoff and logging
  maxRetries: 0,
});

// Centralized model selection with safe defaults
const MODEL_FILTER = (process.env.OPENAI_MODEL_FILTER || '').trim() || 'gpt-5-nano';
const MODEL_HEADLINES = (process.env.OPENAI_MODEL_HEADLINES || '').trim() || 'gpt-5-nano';
const MODEL_SUMMARY = (process.env.OPENAI_MODEL_SUMMARY || process.env.OPENAI_MODEL || '').trim() || 'gpt-5-mini';

// Heuristic: which models support JSON-schema structured output via Responses API
function supportsJsonSchema(model: string): boolean {
  // Many "nano/mini/4.1/o*" families support schema; chat-latest typically does not
  return /nano|mini|o\d|4\.1|omni/i.test(model) && !/chat/i.test(model);
}

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

const LANGUAGE_PROMPTS = {
  en: {
    filterPrompt: (articles: ProcessedArticle[]) => `
You are a neutral front-page editor for a global daily brief. Select only unique, consequential developments from the last 24 hours.

Keep:
- Major government/business decisions; conflict/war actions with clear civilian, territorial, or market impact; disasters/climate; elections; public health; science/tech with broad significance.

Drop:
- Celebrity, local-only items, opinion/analysis/body-language, explainers, live blogs with no new facts, micro-updates, pure video clips without added facts.

Event de-duplication:
- If multiple items describe the same event (e.g., same quake/strike), keep only the best one; others: set isRelevant=false and in reason note "duplicate of #<index>".

Contested claims:
- If a party to a conflict claims something without independent corroboration, cap relevanceScore at 5 unless the claim itself is a consequential development (e.g., a ceasefire announcement with official follow-up).

Breadth:
- Prefer a mix across regions/categories. After selecting 2–3 top items from one conflict, down-score further similar updates.

Scoring rubric:
- 9–10: watershed/global consequence or mass-casualty disaster.
- 7–8: major national development with global relevance.
- 6: notable update with concrete consequences.
- 3–5: minor/incremental update; soft/analysis; video without new facts.
- 0–2: duplicate/rumor/opinion/meta.

Coverage:
- Create one analysis entry for EVERY Index (0..N-1), even for items you drop. Use isRelevant=false and a concise reason when dropping.

Output exactly this JSON:
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 chars (note duplicates as 'duplicate of #<index>')" } ] }

Articles:
${articles.map((article, index) => `
Index: ${index}
Title: ${article.title}
Source: ${article.source}
Content (short): ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Write one clear, neutral headline per unique event, plus one sentence of context.

Rules:
- One per event: If inputs contain duplicates, output a single merged entry using the most informative link (prefer article over video).
- Headline: 8–14 words, subject first, present tense, no hype.
- Summary: 20–30 words with why it matters or a concrete next step.
- Attribution: For unilateral claims start with "X says ..."; for alleged wrongdoing use "Officials/investigators allege ...".
- Numbers: Prefer "at least X" and include the source when possible; avoid "reports vary" phrasing.
- Do not include the outlet in the title; copy the source exactly into the field.
- Aim for 6–9 items when available.

Return ONLY JSON like:
{ "headlines": [ { "title": "...", "source": "...", "summary": "...", "link": "..." } ] }

Items:
${articles.map((article, index) => `
Index: ${index}
Title: ${article.title}
Source: ${article.source}
Content (short): ${article.content.substring(0, 600)}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Write two connected paragraphs that explain today for a general reader.

Paragraph 1 (110–140 words): Lead with the single most important development; say what changed today; connect 2–3 items; include a near-term implication or next step.
Paragraph 2 (90–120 words): Group the rest by theme; include at least one non-conflict item if available; explain why it matters (markets, policy, rights, safety, science).

Attribution and numbers: Flag contested claims; use "at least X" for early casualty counts and name an authority when possible.
Style: Simple, precise language. Neutral tone. No lists or filler. Avoid phrases like "Taken together"; end with a concrete risk, deadline, or action.

Return ONLY JSON like {"summary":"<p1>\\n\\n<p2>"}

Top items:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  },
  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Sei il caporedattore neutrale di un quotidiano globale. Seleziona solo sviluppi unici e significativi nelle ultime 24 ore.

Tieni:
- Decisioni importanti di governi/aziende; azioni di guerra con impatto chiaro; disastri/clima; elezioni; salute pubblica; scienza/tech di rilevanza ampia.
- Per l'edizione italiana, considera RILEVANTI anche grandi notizie nazionali (politica, economia, giustizia, sicurezza, società) da testate primarie.

Escludi:
- Gossip, localismi minori, opinioni/analisi/linguaggio del corpo, spiegoni, dirette senza fatti nuovi, micro‑aggiornamenti, solo video senza fatti.

De-duplicazione eventi:
- Se più articoli descrivono lo stesso evento, tieni solo il migliore; gli altri: isRelevant=false e in reason annota "duplicato di #<index>".

Afferm. controverse:
- Se una parte in conflitto fa un'affermazione senza conferme indipendenti, limita relevanceScore a 5 salvo impatto immediato e verificabile.

Ampiezza:
- Preferisci mix di regioni/categorie; dopo 2–3 pezzi sullo stesso conflitto, abbassa il punteggio dei successivi.

Rubrica punteggi:
- 9–10: svolta/conseguenze globali o disastro con molte vittime.
- 7–8: grande novità nazionale con rilevanza globale.
- 6: aggiornamento notevole con conseguenze concrete.
- 3–5: aggiornamento minore/analisi/video senza fatti.
- 0–2: duplicato/rumor/opinione/meta.

Copertura:
- Crea una voce di analisi per OGNI Index (0..N-1), anche per gli esclusi. Usa isRelevant=false e una ragione concisa quando escludi.

Restituisci ESATTAMENTE questo JSON:
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 caratteri (per duplicati: 'duplicato di #<index>')" } ] }

Articoli:
${articles.map((article, index) => `
Index: ${index}
Titolo: ${article.title}
Fonte: ${article.source}
Contenuto (breve): ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Scrivi un solo titolo per ciascun evento unico, con una frase di contesto.

Regole:
- Uno per evento: se ci sono duplicati, produci una voce unica usando il link più informativo (meglio articolo che video).
- Titolo: 8–14 parole, soggetto all'inizio, presente, senza enfasi.
- Sommario: 20–30 parole con "perché conta" o un passo successivo concreto.
- Attribuzione: per affermazioni unilaterali usa "X afferma ..."; per illeciti: "Le autorità/indagini sostengono ...".
- Numeri: usa "almeno X" e indica la fonte quando possibile; evita "le fonti variano".
- Non inserire la testata nel titolo; copia la fonte esattamente nel campo.
- Punta a 6–9 voci quando disponibili.

Restituisci SOLO JSON così:
{ "headlines": [ { "title": "...", "source": "...", "summary": "...", "link": "..." } ] }

Articoli:
${articles.map((article, index) => `
Index: ${index}
Titolo: ${article.title}
Fonte: ${article.source}
Contenuto (breve): ${article.content.substring(0, 600)}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Scrivi due paragrafi collegati che spieghino la giornata a un lettore generale.

Paragrafo 1 (110–140 parole): apri con la novità più importante; cosa è cambiato oggi; collega 2–3 notizie; indica una implicazione o prossimo passo.
Paragrafo 2 (90–120 parole): raggruppa il resto per tema; includi almeno una notizia non di conflitto se disponibile; spiega perché conta (mercati, politiche, diritti, sicurezza, scienza).

Attribuzione e numeri: segnala affermazioni controverse; usa "almeno X" per bilanci provvisori e cita un'autorità quando possibile.
Stile: linguaggio semplice e preciso. Tono neutro. No elenchi o riempitivi; evita "Nel complesso"; chiudi con rischio/scadenza/azione concreta.

Restituisci SOLO JSON del tipo {"summary":"<p1>\\n\\n<p2>"}

Notizie principali:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  },
  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Vous êtes le rédacteur en chef neutre d’un quotidien mondial. Sélectionnez uniquement des développements uniques et significatifs des dernières 24 heures.

À garder :
- Décisions publiques/privées majeures ; actions de guerre à impact clair ; catastrophes/climat ; élections ; santé publique ; science/tech de portée large.
- Pour l'édition française, inclure aussi les grandes actualités nationales (politique, économie, justice, sécurité, société) publiées par des médias de référence.

À exclure :
- People, localisme mineur, opinion/analyses/langage corporel, explications, directs sans faits nouveaux, micro‑mises à jour, vidéos seules sans faits.

Dé‑duplication d’événements :
- Si plusieurs items décrivent le même événement, ne garder que le meilleur ; les autres: isRelevant=false et indiquer dans reason « doublon de #<index> ».

Allégations contestées :
- Si une partie au conflit avance une affirmation sans confirmation indépendante, plafonner relevanceScore à 5 sauf impact immédiat et vérifiable.

Diversité :
- Préférer un mélange de régions/catégories ; après 2–3 sujets d’un même conflit, baisser le score des suivants.

Barème :
- 9–10 : tournant/conséquence globale ou catastrophe à nombreuses victimes.
- 7–8 : grande actualité nationale à résonance mondiale.
- 6 : mise à jour notable avec conséquences concrètes.
- 3–5 : mise à jour mineure/analytique/vidéo sans faits.
- 0–2 : doublon/rumeur/opinion/meta.

Couverture :
- Créez une entrée d'analyse pour TOUS les Index (0..N-1), même pour les sujets écartés. Utilisez isRelevant=false et une raison concise.

Retourner EXACTEMENT ce JSON :
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 caractères (doublon de #<index>)" } ] }

Articles :
${articles.map((article, index) => `
Index : ${index}
Titre : ${article.title}
Source : ${article.source}
Contenu (court) : ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Rédigez un seul titre par événement unique, avec une phrase de contexte.

Règles :
- Un par événement : en cas de doublons, produire une seule entrée avec le lien le plus informatif (article plutôt que vidéo).
- Titre : 8–14 mots, sujet en premier, présent, sans emphase.
- Résumé : 20–30 mots avec « pourquoi c’est important » ou une prochaine étape concrète.
- Attribution : pour les affirmations unilatérales, commencez par « X affirme … » ; pour des soupçons : « Les autorités/les enquêteurs allèguent … ».
- Chiffres : utilisez « au moins X » et citez la source lorsque possible ; évitez « les bilans varient ».
- Ne mettez pas le média dans le titre ; copiez la source exactement dans le champ.
- Visez 6–9 sujets lorsque possible.

Retournez UNIQUEMENT du JSON :
{ "headlines": [ { "title": "...", "source": "...", "summary": "...", "link": "..." } ] }

Articles :
${articles.map((article, index) => `
Index : ${index}
Titre : ${article.title}
Source : ${article.source}
Contenu (court) : ${article.content.substring(0, 600)}
Lien : ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Écrivez deux paragraphes reliés qui expliquent la journée au grand public.

Paragraphe 1 (110–140 mots) : l’info la plus importante ; ce qui a changé aujourd’hui ; reliez 2–3 sujets ; indiquez une implication ou prochaine étape.
Paragraphe 2 (90–120 mots) : le reste par thème ; incluez au moins un sujet hors conflit si disponible ; expliquez les enjeux (marchés, politiques, droits, sécurité, science).

Attribution et chiffres : signalez les affirmations contestées ; utilisez « au moins X » pour des bilans provisoires et citez une autorité lorsque possible.
Style : langage simple et précis. Ton neutre. Pas de listes ni de remplissage ; éviter « Pris ensemble ». Terminez par un risque, une échéance ou une action concrète.

Retournez UNIQUEMENT du JSON : {"summary":"<p1>\\n\\n<p2>"}

Sujets clés :
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  }
};

// Internal helper: filter a single chunk of articles via the model
async function filterAndRankArticlesChunk(articles: ProcessedArticle[], languageCode: string): Promise<ProcessedArticle[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.filterPrompt(articles);
  const threshold = (languageCode === 'fr' || languageCode === 'it') ? 5 : 6;

  const wantsSchema = supportsJsonSchema(MODEL_FILTER);
  const response = await withRetry(() => openai.responses.create({
    model: MODEL_FILTER,
    input: prompt,
    ...(wantsSchema ? {
      text: {
        format: {
          type: "json_schema",
          name: "article_analysis",
          strict: true,
          schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                analyses: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      index: { type: "integer" },
                      relevanceScore: { type: "integer", minimum: 0, maximum: 10 },
                      isRelevant: { type: "boolean" },
                      reason: { type: "string" }
                    },
                    required: ["index", "relevanceScore", "isRelevant", "reason"]
                  }
                }
              },
              required: ["analyses"]
          }
        }
      }
    } : {})
  } as unknown as Parameters<typeof openai.responses.create>[0]));

  const result = safeParseJSON<{ analyses: ArticleAnalysis[] }>((response as { output_text?: string }).output_text || '{"analyses":[]}', { analyses: [] as ArticleAnalysis[] });

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

  try {
    const wantsSchema = supportsJsonSchema(MODEL_HEADLINES);
    const response = await withRetry(() => openai.responses.create({
      model: MODEL_HEADLINES,
      input: prompt,
      ...(wantsSchema ? {
        text: {
          format: {
            type: "json_schema",
            name: "headlines_generation",
            strict: true,
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  headlines: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        source: { type: "string" },
                        summary: { type: "string" },
                        link: { type: "string" }
                      },
                      required: ["title", "source", "summary", "link"]
                    }
                  }
                },
                required: ["headlines"]
            }
          }
        }
      } : {})
    } as unknown as Parameters<typeof openai.responses.create>[0]));

    const result = safeParseJSON((response as { output_text?: string }).output_text || '{"headlines":[]}', { headlines: [] as NewsHeadline[] });
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
    ? 'I mercati globali e gli affari internazionali hanno continuato la loro progressione costante oggi, con vari sviluppi nei settori economico, politico e sociale. Nel frattempo, gli indicatori chiave suggeriscono una stabilità continua nella maggior parte delle regioni, mentre le istituzioni di tutto il mondo coordinano le risposte alle sfide emergenti.\n\nQuesti sviluppi riflettono un modello più ampio di cooperazione internazionale e resilienza economica. Mentre governi e organizzazioni navigano dinamiche globali complesse, il loro approccio coordinato dimostra un impegno a mantenere la stabilità affrontando al contempo iniziative strategiche a lungo termine attraverso canali diplomatici ed economici consolidati.'
    : languageCode === 'fr'
    ? 'Les marchés mondiaux et les affaires internationales ont poursuivi leur progression constante aujourd\'hui, avec divers développements dans les secteurs économique, politique et social. Parallèlement, les indicateurs clés suggèrent une stabilité continue dans la plupart des régions, tandis que les institutions du monde entier coordonnent leurs réponses aux défis émergents.\n\nCes développements reflètent un modèle plus large de coopération internationale et de résilience économique. Alors que les gouvernements et les organisations naviguent dans des dynamiques mondiales complexes, leur approche coordonnée démontre un engagement à maintenir la stabilité tout en abordant des initiatives stratégiques à long terme à travers des canaux diplomatiques et économiques établis.'
    : 'Global markets and international affairs continued their steady progression today, with various developments across economic, political, and social sectors. Meanwhile, key indicators suggest ongoing stability in most regions, as institutions worldwide coordinate responses to emerging challenges.\n\nThese developments reflect a broader pattern of international cooperation and economic resilience. As governments and organizations navigate complex global dynamics, their coordinated approach demonstrates a commitment to maintaining stability while addressing long-term strategic initiatives through established diplomatic and economic channels.';

  try {
    const apiStart = Date.now();
    const response = await withRetry(() => openai.responses.create({
      model: MODEL_SUMMARY,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "daily_summary",
          strict: true,
          schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: {
                  type: "string",
                  description: "Two well-connected paragraphs separated by \\n\\n"
                }
              },
              required: ["summary"]
          }
        }
      }
    } as unknown as Parameters<typeof openai.responses.create>[0]));
    const apiMs = Date.now() - apiStart;
    console.log(`generateDailySummary: OpenAI response time ${apiMs} ms`);

    const result = safeParseJSON((response as { output_text?: string }).output_text || '{"summary":"Unable to generate summary."}', { summary: fallbackSummary });
    return result.summary || fallbackSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return fallbackSummary;
  }
} 
