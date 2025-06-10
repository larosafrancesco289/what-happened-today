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
Your goal is to create a natural, high-level narrative that explains the state of the world today, not just list events.
Connect different events and themes to show their broader context and interplay.
The tone should be calm, factual, and thoughtfully analytical, like a briefing from a trusted international news analyst.

Today's top stories to synthesize:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source})
Summary: ${headline.summary}
`).join('\n')}

**Instructions for Writing:**
-   **Find the Narrative:** Instead of just listing events, identify an overarching theme or the most significant development to lead the summary. Ask yourself: What is the most important "story" of the day?
-   **Weave, Don't Stack:** Use sophisticated transitions to connect topics. Go beyond "Meanwhile" or "Separately." Try phrases that show relationships, like: "This focus on economic diplomacy comes as...", "The environmental talks stand in contrast to ongoing geopolitical friction, where...", or "Underpinning these events is a broader trend of..."
-   **Thematic Grouping:** Group related stories. For instance, combine stories about economic shifts, geopolitical tensions, or social changes, even if they happened in different parts of the world.
-   **Analytical Conclusion:** The final sentences should provide a broader context, explaining what these developments collectively suggest about global trends, challenges, or dynamics.

**Structure:**
-   **Paragraph 1:** Start with the day's most impactful story or a central theme that connects multiple events. Weave in 2-3 related developments, explaining their connection.
-   **Paragraph 2:** Cover the remaining significant events, linking them thematically to the first paragraph or to each other. Conclude with a sentence or two on the broader implications of the day's news.
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
Scrivi un riassunto coeso e scorrevole di 2 paragrafi sulle notizie globali più importanti di oggi.
Il tuo obiettivo è creare una narrazione naturale e di alto livello che spieghi lo stato del mondo oggi, non solo un elenco di eventi.
Collega eventi e temi diversi per mostrare il loro contesto più ampio e la loro interazione.
Il tono deve essere calmo, fattuale e analiticamente riflessivo, come un briefing di un fidato analista di notizie internazionali.

Le principali notizie di oggi da sintetizzare:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source})
Riassunto: ${headline.summary}
`).join('\n')}

**Istruzioni per la scrittura:**
-   **Trova la Narrazione:** Invece di elencare semplicemente gli eventi, identifica un tema generale o lo sviluppo più significativo per guidare il riassunto. Chiediti: qual è la "storia" più importante della giornata?
-   **Intreccia, non Impilare:** Usa transizioni sofisticate per collegare gli argomenti. Vai oltre "Nel frattempo" o "Separatamente". Prova frasi che mostrino relazioni, come: "Questo focus sulla diplomazia economica arriva mentre...", "I colloqui sull'ambiente si contrappongono alle continue tensioni geopolitiche, dove...", o "Alla base di questi eventi c'è una tendenza più ampia di..."
-   **Raggruppamento Tematico:** Raggruppa le storie correlate. Ad esempio, combina storie su cambiamenti economici, tensioni geopolitiche o cambiamenti sociali, anche se si sono verificati in diverse parti del mondo.
-   **Conclusione Analitica:** Le frasi finali dovrebbero fornire un contesto più ampio, spiegando cosa questi sviluppi suggeriscono collettivamente sulle tendenze, sfide o dinamiche globali.

**Struttura:**
-   **Paragrafo 1:** Inizia con la storia più impattante della giornata o un tema centrale che collega più eventi. Intreccia 2-3 sviluppi correlati, spiegandone la connessione.
-   **Paragrafo 2:** Copri gli eventi significativi rimanenti, collegandoli tematicamente al primo paragrafo o tra loro. Concludi con una o due frasi sulle implicazioni più ampie delle notizie del giorno.
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
      temperature: 0.6,
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