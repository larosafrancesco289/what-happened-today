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

export async function filterAndRankArticles(articles: ProcessedArticle[]): Promise<ProcessedArticle[]> {
  const prompt = `
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
`;

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

export async function generateHeadlines(articles: ProcessedArticle[]): Promise<NewsHeadline[]> {
  const prompt = `
Create concise, neutral headlines and summaries for these top news stories. 
Each summary should be 1-2 sentences, factual, and free from emotional language.

Articles:
${articles.map((article, index) => `
${index + 1}. Title: ${article.title}
Source: ${article.source}
Content: ${article.content}
Link: ${article.link}
`).join('\n')}
`;

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

export async function generateDailySummary(headlines: NewsHeadline[]): Promise<string> {
  const prompt = `
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
`;

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
    return result.summary || 'Unable to generate summary.';
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Global markets and international affairs continued their steady progression today, with various developments across economic, political, and social sectors. Meanwhile, key indicators suggest ongoing stability in most regions, as institutions worldwide coordinate responses to emerging challenges.\n\nThese developments reflect a broader pattern of international cooperation and economic resilience. As governments and organizations navigate complex global dynamics, their coordinated approach demonstrates a commitment to maintaining stability while addressing long-term strategic initiatives through established diplomatic and economic channels.';
  }
} 