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
You are a neutral news editor. Pick the items that matter to most people worldwide today.

Simple rules:
- Keep major government, business, conflict, disaster, climate, election, science/tech stories.
- Drop celebrity, local-only items, opinion, or tiny incremental updates.
- Be careful with rumor or clickbait; prefer facts.

Scoring:
- relevanceScore: 0–10 (10 = must-know globally; 5 = notable; 0 = not relevant)
- isRelevant: true if score >= 6
- index is zero-based (0..N-1)

Return ONLY JSON matching this shape:
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 chars" } ] }

Articles:
${articles.map((article, index) => `
Index: ${index}
Title: ${article.title}
Source: ${article.source}
Content (short): ${article.content.substring(0, 500)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Write a clear, neutral headline and one short sentence of context for each item.

Rules:
- Headline: 6–12 words, present tense, no hype.
- Summary: 18–24 words, add key context not obvious from the headline.
- Do not include the outlet in the headline; copy source exactly in the field.

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
Write two short, connected paragraphs that explain today to a general reader.

Guidance:
- Para 1 (90–130 words): lead with the most important development; connect 2–3 items.
- Para 2 (90–130 words): cover the rest by theme; explain why it matters.
- Use simple, precise language. Neutral tone. No lists.

Return ONLY JSON like {"summary":"<p1>\\n\\n<p2>"}

Top items:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  },
  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Sei un redattore neutrale. Scegli gli articoli che contano per la maggior parte delle persone oggi.

Regole semplici:
- Tieni decisioni di governi e aziende, conflitti, disastri, clima, elezioni, scienza/tecnologia importanti.
- Per l'edizione italiana, considera RILEVANTI anche notizie nazionali di grande impatto (politica, economia, giustizia, sicurezza, società) riportate da testate primarie.
- Escludi gossip, localismi minori, opinioni, micro‑aggiornamenti.

Punteggio:
- relevanceScore: 0–10 (10 = essenziale; 5 = notevole; 0 = irrilevante)
- Mira a selezionare 6–10 articoli se disponibili.
- index è a base zero (0..N-1)

Restituisci SOLO JSON così:
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 caratteri" } ] }

Articoli:
${articles.map((article, index) => `
Index: ${index}
Titolo: ${article.title}
Fonte: ${article.source}
Contenuto (breve): ${article.content.substring(0, 500)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Scrivi un titolo chiaro e neutro e una frase breve di contesto per ciascun articolo.

Regole:
- Titolo: 6–12 parole, tempo presente, senza enfasi.
- Sommario: 18–24 parole, aggiungi contesto chiave non evidente dal titolo.
- Non inserire la testata nel titolo; copia esattamente la fonte nel campo.

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
Scrivi due paragrafi brevi e collegati che spieghino la giornata a un lettore generale.

Guida:
- Paragrafo 1 (90–130 parole): apri con lo sviluppo principale; collega 2–3 notizie.
- Paragrafo 2 (90–130 parole): tratta il resto per tema; spiega perché conta.
- Linguaggio semplice e preciso. Tono neutro. Niente elenchi.

Restituisci SOLO JSON del tipo {"summary":"<p1>\\n\\n<p2>"}

Notizie principali:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  },
  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Vous êtes un éditeur neutre. Choisissez les sujets qui comptent aujourd'hui.

Règles simples :
- Conservez décisions publiques/privées majeures, conflits, catastrophes, climat, élections, science/tech importantes.
- Pour l'édition française, considérez comme PERTINENTES les grandes actualités nationales (politique, économie, justice, sécurité, société) publiées par des médias de référence.
- Écartez people, localisme mineur, opinion, micro‑mises à jour.

Notation :
- relevanceScore : 0–10 (10 = essentiel ; 5 = notable ; 0 = hors sujet)
- Objectif : 6–10 sujets si disponibles.
- index est à base zéro (0..N-1)

Retournez UNIQUEMENT du JSON ainsi :
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "... <=200 caractères" } ] }

Articles :
${articles.map((article, index) => `
Index : ${index}
Titre : ${article.title}
Source : ${article.source}
Contenu (court) : ${article.content.substring(0, 500)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Rédigez un titre clair et neutre et une courte phrase de contexte pour chaque article.

Règles :
- Titre : 6–12 mots, présent, sans emphase.
- Résumé : 18–24 mots, ajouter le contexte clé non évident du titre.
- Ne mettez pas le média dans le titre ; copiez exactement la source dans le champ.

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
Écrivez deux courts paragraphes reliés qui expliquent la journée au grand public.

Guide :
- Paragraphe 1 (90–130 mots) : l’info principale ; reliez 2–3 sujets.
- Paragraphe 2 (90–130 mots) : le reste par thème ; pourquoi c’est important.
- Langage simple et précis. Ton neutre. Pas de liste.

Retournez UNIQUEMENT du JSON : {"summary":"<p1>\\n\\n<p2>"}

Sujets clés :
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) — ${headline.summary}
`).join('\n')}
`
  }
};

export async function filterAndRankArticles(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.filterPrompt(articles);
  const threshold = (languageCode === 'fr' || languageCode === 'it') ? 5 : 6;

  try {
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
          // Apply language-aware threshold to accept significant national news for FR/IT
          isRelevant: score >= threshold,
        };
      })
      .filter(article => article.isRelevant)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
  } catch (error) {
    console.error('Error filtering articles:', error);
    return articles.slice(0, 10); // Fallback: return first 10 articles
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
