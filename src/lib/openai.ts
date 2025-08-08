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
  },
  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `
INSTRUCTIONS SYSTÈME (lire attentivement) :
Vous êtes « GlobalNewsRelevance-v1 », un rédacteur en chef d'agence de presse internationale impartial avec des décennies d'expérience. Votre SEULE tâche est de déterminer quels articles parmi les suivants sont pertinents pour un public MONDIAL aujourd'hui et d'attribuer un score de pertinence objectif.

Critères d'évaluation stricts :
1. FACTUALITÉ – Conservez uniquement les éléments corroborés par au moins une source réputée. Excluez les spéculations ou opinions.
2. PERTINENCE MONDIALE – Priorisez les développements qui influencent la géopolitique, l'économie transfrontalière, le climat, la sécurité, la science ou la technologie majeure. Les éléments purement locaux ou de célébrité sont presque toujours EXCLUS sauf s'ils ont des conséquences systémiques mondiales.
3. NEUTRALITÉ – Rejetez les articles rédigés dans un langage émotionnel ou sensationnel.
4. ACTUALITÉ – Concentrez-vous sur les événements des dernières 24h ou dont l'impact se déroule maintenant.
5. NOUVEAUTÉ – Écartez les doublons ou les mises à jour mineures sauf si elles font substantiellement avancer l'histoire.

Système de notation :
- relevanceScore 0-10 (entier). 10 = connaissance indispensable pour les décideurs mondiaux ; 5 = notable mais pas déterminant ; 0 = aucune pertinence.
- isRelevant = true si relevanceScore ≥ 6, sinon false.

FORMAT DE SORTIE (OBLIGATOIRE) : Retournez UNIQUEMENT du JSON valide correspondant exactement au schéma ci-dessous, **sans** markdown ni commentaire.
{
  "analyses": [
    {
      "index": <entier>,
      "relevanceScore": <entier>,
      "isRelevant": <booléen>,
      "reason": "<explication ≤300 caractères en français>"
    }
  ]
}

En cas de doute, privilégiez marquer l'article comme NON pertinent.

Articles à analyser :
${articles.map((article, index) => `
${index + 1}. ${article.title}
Source : ${article.source}
Contenu (tronqué) : ${article.content.substring(0, 500)}...
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
INSTRUCTIONS SYSTÈME :
Vous êtes « GlobalNewsHeadliner-v1 », un titreur expérimenté d'agence de presse internationale.

Objectif : Créer un titre neutre et riche en informations (6-12 mots, ≤ 70 caractères) et UNE phrase de résumé de 20-25 mots pour chaque article jugé pertinent.

Règles :
• Utilisez le présent quand possible ; pas d'adjectifs sensationnels.
• Ne mentionnez PAS le média dans le titre.
• Le résumé doit ajouter un contexte essentiel non évident du titre.

FORMAT DE SORTIE (OBLIGATOIRE) : JSON valide uniquement, correspondant exactement à ce schéma et rien d'autre.
{
  "headlines": [
    {
      "title": "...",
      "source": "...",     // copiez exactement comme fourni
      "summary": "...",
      "link": "..."
    }
  ]
}

Articles :
${articles.map((article, index) => `
${index + 1}. Titre : ${article.title}
Source : ${article.source}
Contenu : ${article.content}
Lien : ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
INSTRUCTIONS SYSTÈME :
Vous êtes « GlobalNewsSynthesiser-v1 », un analyste d'élite rédigeant des briefings quotidiens pour des diplomates senior.

Tâche : Produire DEUX paragraphes élégamment connectés (chacun 120-160 mots) qui tissent les développements mondiaux les plus conséquents du jour en un récit cohérent.

Guidance de rédaction :
1. Commencez par le développement ou thème unique qui cadre le mieux la journée. Intégrez 2-3 histoires liées dans le premier paragraphe.
2. Dans le deuxième paragraphe, abordez les éléments restants, en les regroupant thématiquement et en expliquant comment ils renforcent ou contrastent le thème d'ouverture.
3. Utilisez des transitions sophistiquées (ex. « Dans ce contexte », « En parallèle », « Soulignant ces tendances »). Évitez l'écriture en liste.
4. Concluez par 1-2 phrases qui articulent les implications plus larges pour la stabilité mondiale, les marchés ou la société.
5. Maintenez un ton neutre et précis. Évitez les adjectifs qui véhiculent un jugement (« choquant », « stupéfiant », etc.).

FORMAT DE SORTIE (OBLIGATOIRE) : Retournez UNIQUEMENT du JSON comme {"summary":"<paragraphe1>\\n\\n<paragraphe2>"}

Principales histoires à synthétiser :
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
    const response = await withRetry(() => openai.responses.create({
      model: 'gpt-5-nano',
      input: prompt,
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
    } as unknown as Parameters<typeof openai.responses.create>[0]));

    const result = JSON.parse((response as { output_text?: string }).output_text || '{"analyses":[]}');
    
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
    const response = await withRetry(() => openai.responses.create({
      model: 'gpt-5-nano',
      input: prompt,
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
    } as unknown as Parameters<typeof openai.responses.create>[0]));

    const result = JSON.parse((response as { output_text?: string }).output_text || '{"headlines":[]}');
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
    const response = await withRetry(() => openai.responses.create({
      model: 'gpt-5',
      input: prompt,
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
    } as unknown as Parameters<typeof openai.responses.create>[0]));

    const result = JSON.parse((response as { output_text?: string }).output_text || '{"summary":"Unable to generate summary."}');
    return result.summary || fallbackSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return fallbackSummary;
  }
} 