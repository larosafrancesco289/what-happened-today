import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline } from '@/types/news';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ArticleAnalysis {
  index: number;
  relevanceScore: number;
  isRelevant: boolean;
  reason: string;
}

const LANGUAGE_PROMPTS = {
  en: {
    filterPrompt: (articles: ProcessedArticle[]) => `
You are an expert news analyst. Analyze these news articles and filter/rank them:

1. Filter out irrelevant, emotional, clickbait, or non-factual content
2. Keep only neutral, factual, globally significant news
3. Rank them by importance (0-10 scale)
4. Focus on the top 10-15 most important stories

Articles to analyze:
${articles.map((article, index) => `
${index + 1}. ${article.title}
Source: ${article.source}
Content: ${article.content.substring(0, 500)}...
`).join('\n')}

Focus on stories that are:
- Factual and verifiable
- Globally significant
- Not sensationalized or emotional
- Not celebrity gossip or entertainment
- Not overly technical or niche
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Create concise, neutral headlines and summaries for these top news stories. 
Each summary should be 1-2 sentences, factual, and free from emotional language.

Articles:
${articles.map((article, index) => `
${index + 1}. Title: ${article.title}
Source: ${article.source}
Content: ${article.content}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Write a cohesive, well-flowing 2-paragraph summary of today's most important global news.
Create a natural narrative that connects different events and themes where possible.
The tone should be calm, factual, and thoughtfully analytical.

Today's top stories:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source})
Summary: ${headline.summary}
`).join('\n')}

Instructions for writing:
- Start with the most significant development or overarching theme
- Use transitional phrases to connect different topics naturally (e.g., "Meanwhile," "In related developments," "This comes as," "Separately but significantly")
- When possible, draw connections between events (economic impacts, geopolitical relationships, etc.)
- Each paragraph should have 4-5 sentences with smooth flow between ideas
- End with broader context about what these developments mean collectively
- Maintain a neutral, informative tone without sensationalism
- Focus on factual reporting while providing thoughtful analysis of implications

Structure:
Paragraph 1: Lead with the most impactful story, then weave in 1-2 related developments
Paragraph 2: Cover remaining significant events, connecting them where logical, and conclude with broader implications
`
  },
  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Sei un esperto analista di notizie. Analizza questi articoli di notizie e filtrali/classificali:

1. Filtra contenuti irrilevanti, emotivi, clickbait o non fattuali
2. Mantieni solo notizie neutrali, fattuali e significative a livello globale
3. Classificali per importanza (scala 0-10)
4. Concentrati sulle 10-15 storie più importanti

Articoli da analizzare:
${articles.map((article, index) => `
${index + 1}. ${article.title}
Fonte: ${article.source}
Contenuto: ${article.content.substring(0, 500)}...
`).join('\n')}

Concentrati su storie che sono:
- Fattuali e verificabili
- Significative a livello globale
- Non sensazionalizzate o emotive
- Non gossip sui celebrity o intrattenimento
- Non eccessivamente tecniche o di nicchia
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Crea titoli concisi e neutrali e riassunti per queste principali notizie. 
Ogni riassunto dovrebbe essere di 1-2 frasi, fattuale e privo di linguaggio emotivo.

Articoli:
${articles.map((article, index) => `
${index + 1}. Titolo: ${article.title}
Fonte: ${article.source}
Contenuto: ${article.content}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Scrivi un riassunto coeso e ben strutturato di 2 paragrafi delle notizie globali più importanti di oggi.
Crea una narrazione naturale che colleghi eventi e temi diversi dove possibile.
Il tono dovrebbe essere calmo, fattuale e analiticamente riflessivo.

Le principali notizie di oggi:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source})
Riassunto: ${headline.summary}
`).join('\n')}

Istruzioni per la scrittura:
- Inizia con lo sviluppo più significativo o il tema dominante
- Usa frasi di transizione per collegare naturalmente argomenti diversi (es. "Nel frattempo," "In sviluppi correlati," "Questo avviene mentre," "Separatamente ma significativamente")
- Quando possibile, traccia connessioni tra eventi (impatti economici, relazioni geopolitiche, ecc.)
- Ogni paragrafo dovrebbe avere 4-5 frasi con un flusso fluido tra le idee
- Termina con un contesto più ampio su cosa significano collettivamente questi sviluppi
- Mantieni un tono neutrale e informativo senza sensazionalismo
- Concentrati su reportage fattuali fornendo analisi ponderate delle implicazioni

Struttura:
Paragrafo 1: Inizia con la storia più impattante, poi intreccia 1-2 sviluppi correlati
Paragrafo 2: Copri gli eventi significativi rimanenti, collegandoli dove logico, e concludi con implicazioni più ampie
`
  }
};

export async function filterAndRankArticles(articles: ProcessedArticle[], languageCode: string = 'en'): Promise<ProcessedArticle[]> {
  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.filterPrompt(articles);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
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
    });

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
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
    });

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
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
    });

    const result = JSON.parse(response.choices[0].message.content || '{"summary":"Unable to generate summary."}');
    return result.summary || fallbackSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return fallbackSummary;
  }
} 