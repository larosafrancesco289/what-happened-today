import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline } from '@/types/news';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000, // 90 second timeout
  maxRetries: 2, // Retry failed requests up to 2 times
});

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
SYSTEM INSTRUCTIONS (read carefully):
You are "GlobalNewsRelevance-v1", an experienced, unbiased wire-service editor. Your ONLY task is to decide which of the following articles matter to a GLOBAL audience today and to assign an objective relevance score.

Strict evaluation criteria:
1. FACTUALITY – Keep items corroborated by at least one reputable outlet. Exclude speculation or opinion.
2. GLOBAL SIGNIFICANCE – Prioritise developments that influence geopolitics, cross-border economics, climate, security, major science or technology. Purely local or celebrity items are almost always OUT unless they have systemic global consequences.
3. NEUTRALITY – Reject stories written in emotional or sensational language.
4. TIMELINESS – Focus on events in the past 24 h or whose impact is unfolding now.
5. NOVELTY – Discard duplicates or minor incremental updates unless they substantially move the story forward.

Scoring rubric:
- relevanceScore 0-10 (integer). 10 = indispensable knowledge for global decision-makers; 5 = notable but not game-changing; 0 = no relevance.
- isRelevant = true if relevanceScore ≥ 6, else false.

OUTPUT FORMAT (MANDATORY): Return ONLY valid JSON matching exactly the schema below, **without** markdown or commentary.
{
  "analyses": [
    {
      "index": <integer>,
      "relevanceScore": <integer>,
      "isRelevant": <boolean>,
      "reason": "<≤300 characters explanation in English>"
    }
  ]
}

If you are uncertain, err on the side of marking the article NOT relevant.

Articles to analyse:
${articles.map((article, index) => `
${index + 1}. ${article.title}
Source: ${article.source}
Content (truncated): ${article.content.substring(0, 500)}...
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
SYSTEM INSTRUCTIONS:
You are "GlobalNewsHeadliner-v1", a seasoned international copy-editor.

Goal: Craft a neutral, information-dense headline (6-12 words, ≤ 70 characters) and a SINGLE, 20-25-word summary sentence for each article deemed relevant.

Rules:
• Use present tense where possible; no sensational adjectives.
• Do NOT mention the news outlet inside the headline.
• The summary must add essential context not obvious from the headline.

OUTPUT FORMAT (MANDATORY): Valid JSON only, matching this schema exactly and nothing else.
{
  "headlines": [
    {
      "title": "...",
      "source": "...",     // copy exactly as provided
      "summary": "...",
      "link": "..."
    }
  ]
}

Articles:
${articles.map((article, index) => `
${index + 1}. Title: ${article.title}
Source: ${article.source}
Content: ${article.content}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
SYSTEM INSTRUCTIONS:
You are "GlobalNewsSynthesiser-v1", an elite analyst crafting daily briefings for senior diplomats.

Task: Produce TWO elegantly-connected paragraphs (each 120-160 words) that weave the day's most consequential global developments into a coherent narrative.

Writing guidance:
1. Lead with the single development or theme that best frames the day. Integrate 2-3 linked stories within the first paragraph.
2. In paragraph two, address the remaining items, grouping them thematically and explaining how they reinforce or contrast the opening theme.
3. Use sophisticated transitions (e.g., "Against this backdrop,", "In parallel,", "Underscoring these trends."). Avoid list-like writing.
4. Conclude with 1-2 sentences that articulate the broader implications for global stability, markets, or society.
5. Maintain neutral, precise tone. Avoid adjectives that convey judgement ("shocking", "stunning", etc.).

OUTPUT FORMAT (MANDATORY): Return ONLY JSON like {"summary":"<paragraph1>\n\n<paragraph2>"}

Top stories to synthesise:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) – ${headline.summary}
`).join('\n')}
`
  },
  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `
ISTRUZIONI DI SISTEMA (leggere con attenzione):
Sei "GlobalNewsRelevance-v1", un redattore di agenzia internazionale imparziale con decenni di esperienza. Il tuo UNICO compito è stabilire quali degli articoli seguenti siano rilevanti per un pubblico GLOBALE oggi e assegnare un punteggio di rilevanza.

Criteri rigorosi di valutazione:
1. FATTUALITÀ – Mantieni solo elementi confermati da almeno una fonte autorevole. Escludi opinioni e speculazioni.
2. RILEVANZA GLOBALE – Dai priorità agli sviluppi che incidono su geopolitica, economia transfrontaliera, clima, sicurezza, scienza o tecnologia di ampia portata. Le notizie strettamente locali o di spettacolo sono da escludere salvo conseguenze sistemiche globali.
3. NEUTRALITÀ – Scarta articoli con linguaggio emotivo o sensazionalistico.
4. ATTUALITÀ – Concentrati su eventi avvenuti nelle ultime 24 h o con impatto in corso.
5. NOVITÀ – Elimina duplicati o aggiornamenti marginali che non cambiano sostanzialmente la storia.

Schema di punteggio:
- relevanceScore 0-10 (intero). 10 = informazione indispensabile per decisori globali; 5 = rilevante ma non determinante; 0 = irrilevante.
- isRelevant = true se relevanceScore ≥ 6, altrimenti false.

FORMATO DI OUTPUT (OBBLIGATORIO): restituisci SOLO JSON valido conforme esattamente allo schema seguente, senza markdown o commenti.
{
  "analyses": [
    {
      "index": <integer>,
      "relevanceScore": <integer>,
      "isRelevant": <boolean>,
      "reason": "<spiegazione ≤300 caratteri in italiano>"
    }
  ]
}

In caso di dubbio, preferisci segnare l'articolo come NON rilevante.

Articoli da analizzare:
${articles.map((article, index) => `
${index + 1}. ${article.title}
Fonte: ${article.source}
Contenuto (troncato): ${article.content.substring(0, 500)}...
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
ISTRUZIONI DI SISTEMA:
Sei "GlobalNewsHeadliner-v1", un titolista esperto di agenzia stampa internazionale.

Obiettivo: Genera un titolo neutro e denso di informazioni (6-12 parole, ≤ 70 caratteri) e UNA frase riassuntiva di 20-25 parole per ciascun articolo rilevante.

Regole:
• Usa preferibilmente il presente; evita aggettivi sensazionalistici.
• Non citare la testata nel titolo.
• Il riassunto deve aggiungere contesto essenziale non evidente dal titolo.

FORMATO DI OUTPUT (OBBLIGATORIO): solo JSON valido che rispetti esattamente questo schema, nient'altro.
{
  "headlines": [
    {
      "title": "...",
      "source": "...",   // copia esattamente come fornito
      "summary": "...",
      "link": "..."
    }
  ]
}

Articoli:
${articles.map((article, index) => `
${index + 1}. Titolo: ${article.title}
Fonte: ${article.source}
Contenuto: ${article.content}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
ISTRUZIONI DI SISTEMA:
Sei "GlobalNewsSynthesiser-v1", un analista di alto livello che redige briefing quotidiani per diplomatici senior.

Compito: Produci DUE paragrafi connessi in modo elegante (ognuno 120-160 parole) che intreccino gli sviluppi globali più significativi del giorno in una narrazione coerente.

Guida alla scrittura:
1. Apri con lo sviluppo o il tema che meglio incornicia la giornata; integra 2-3 storie collegate nel primo paragrafo.
2. Nel secondo paragrafo affronta gli altri elementi, raggruppandoli tematicamente e spiegando come rafforzano o contrastano il tema iniziale.
3. Usa transizioni sofisticate (es. "Su questo sfondo", "In parallelo", "A sottolineare questa tendenza"). Evita la scrittura a elenco.
4. Concludi con 1-2 frasi che evidenzino le implicazioni più ampie per stabilità globale, mercati o società.
5. Mantieni tono neutro e preciso. Evita aggettivi di giudizio ("scioccante", "sbalorditivo", ecc.).

FORMATO DI OUTPUT (OBBLIGATORIO): restituisci SOLO JSON del tipo {"summary":"<paragrafo1>\n\n<paragrafo2>"}

Principali notizie da sintetizzare:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) – ${headline.summary}
`).join('\n')}
`
  }
};

export async function filterAndRankArticles(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.filterPrompt(articles);

  try {
    const response = await withRetry(() => openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "article_analysis",
          schema: {
            type: "object",
            properties: {
              analyses: {
                type: "array",
                items: {
                  type: "object",
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
    }));

    const result = JSON.parse(response.choices[0].message.content || '{"analyses":[]}');
    
    return articles
      .map((article, index) => {
        const analysis: ArticleAnalysis | undefined = result.analyses?.find((r: ArticleAnalysis) => r.index === index);
        return {
          ...article,
          relevanceScore: analysis?.relevanceScore || 0,
          isRelevant: analysis?.isRelevant || false,
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
    const response = await withRetry(() => openai.chat.completions.create({
      model: 'gpt-4.1-nano',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "headlines_generation",
          schema: {
            type: "object",
            properties: {
              headlines: {
                type: "array",
                items: {
                  type: "object",
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
    }));

    const result = JSON.parse(response.choices[0].message.content || '{"headlines":[]}');
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
    : 'Global markets and international affairs continued their steady progression today, with various developments across economic, political, and social sectors. Meanwhile, key indicators suggest ongoing stability in most regions, as institutions worldwide coordinate responses to emerging challenges.\n\nThese developments reflect a broader pattern of international cooperation and economic resilience. As governments and organizations navigate complex global dynamics, their coordinated approach demonstrates a commitment to maintaining stability while addressing long-term strategic initiatives through established diplomatic and economic channels.';

  try {
    const response = await withRetry(() => openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: prompt }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_summary",
          schema: {
            type: "object",
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
    }));

    const result = JSON.parse(response.choices[0].message.content || '{"summary":"Unable to generate summary."}');
    return result.summary || fallbackSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return fallbackSummary;
  }
} 