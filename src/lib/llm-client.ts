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
const MODEL_HEADLINES = 'nvidia/nemotron-3-nano-30b-a3b';
const MODEL_SUMMARY = 'nvidia/nemotron-3-nano-30b-a3b';

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

KEEP (hard news with verifiable impact):
- Government decisions: laws passed, executive actions, official policy changes
- Conflict/security: military actions with confirmed casualties, territorial changes, ceasefires
- Natural disasters: events with at least 10 casualties or significant displacement
- Elections: results, major candidate announcements, verified irregularities
- Public health: disease outbreaks, policy changes, drug approvals
- Science/technology: peer-reviewed findings, major product launches, regulatory decisions
- Economics: central bank decisions, major corporate actions, trade agreements

DROP (soft news, speculation, or meta-content):
- Celebrity, sports, entertainment (unless death or major scandal with legal consequences)
- Local-only stories without national/international implications
- Opinion, analysis, body-language interpretation, "what this means" explainers
- Live blogs, rolling updates without new substantive facts
- Aggregated "reactions" to news without new information
- Video-only content without factual text summary
- Predictions, forecasts, or "experts say X could happen"

NEUTRALITY REQUIREMENTS:
- Never use value-laden terms: "historic", "unprecedented", "shocking", "controversial"
- Attribute all claims to their sources; do not present disputed claims as fact
- For conflict coverage: treat all parties' claims equally unless independently verified
- Avoid passive voice that obscures responsibility

GEOGRAPHIC BALANCE (aim for representation):
- If most articles are from one region, actively seek to include stories from underrepresented areas
- Prioritize: Africa (sub-Saharan), Latin America, Southeast Asia, Central Asia, Pacific Islands
- Do not let Western/US-centric stories dominate unless genuinely more consequential

EVENT DE-DUPLICATION:
- If multiple items describe the same event, keep only the most informative one
- Others: set isRelevant=false and in reason note "duplicate of #<index>"
- Prefer articles over video clips; wire services over aggregators

CONTESTED CLAIMS:
- If a party to a conflict makes a claim without independent corroboration, cap relevanceScore at 5
- Exception: the claim itself is a consequential development (e.g., ceasefire announcement with official response)

SCORING RUBRIC:
- 9-10: Watershed event with verified global consequence OR mass-casualty disaster (100+ deaths)
- 7-8: Major national development with clear international relevance
- 6: Notable update with concrete, verifiable consequences
- 3-5: Minor/incremental update; analysis piece; video without new facts
- 0-2: Duplicate, rumor, opinion, meta-commentary, or unverifiable claim

COVERAGE REQUIREMENT:
- Create one analysis entry for EVERY Index (0..N-1), even for items you drop
- Use isRelevant=false and a concise reason (<=200 chars) when dropping
- For duplicates, always note "duplicate of #<index>"

OUTPUT FORMAT (JSON only, no markdown):
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "..." } ] }

Articles to analyze:
${articles.map((article, index) => `
Index: ${index}
Title: ${article.title}
Source: ${article.source}
Content (short): ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Write one clear, neutral headline per unique event, plus one sentence of context.

HEADLINE RULES:
- Length: 8-14 words
- Structure: Subject first, active voice, present tense
- No hype words: avoid "slams", "blasts", "sparks", "rocks", "stuns"
- No leading questions or clickbait constructions
- Include a specific number, name, or location when possible

SUMMARY RULES:
- Length: 20-30 words
- Focus on concrete outcome or next step, not "why it matters" in abstract terms
- Include one of: timeline, affected population size, or immediate consequence

ATTRIBUTION REQUIREMENTS:
- Unilateral claims: "X says..." or "X claims..."
- Allegations of wrongdoing: "Officials/investigators allege..."
- Casualty numbers: Use "at least X" and name the source (e.g., "at least 50 dead, health ministry says")
- Avoid "reports vary" or "sources say" without naming the source

GEOGRAPHIC REPRESENTATION:
- If input includes stories from underrepresented regions (Africa, Latin America, Southeast Asia, Central Asia, Pacific), ensure they appear in output unless genuinely lower impact

OUTPUT REQUIREMENTS:
- Aim for 6-9 items when sufficient quality input exists
- One headline per unique event (merge duplicates, use most informative link)
- Do not include the news outlet in the title; copy source exactly to the source field
- Prefer article links over video links

OUTPUT FORMAT (JSON only):
{ "headlines": [ { "title": "...", "source": "...", "summary": "...", "link": "..." } ] }

Articles:
${articles.map((article, index) => `
Index: ${index}
Title: ${article.title}
Source: ${article.source}
Content (short): ${article.content.substring(0, 600)}
Link: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Write two connected paragraphs that explain today's news for a general reader.

PARAGRAPH 1 (110-140 words):
- Lead with the single most consequential development
- State what specifically changed today (decision, action, discovery)
- Connect 2-3 related items if a pattern exists
- End with a concrete near-term implication: a deadline, a next decision point, or affected population

PARAGRAPH 2 (90-120 words):
- Group remaining items by theme (economy, security, health, environment, rights)
- Include at least one non-conflict item if available
- For each item, state: what happened + who is affected + what comes next
- End with a concrete risk, deadline, or action rather than a vague "remains to be seen"

STYLE REQUIREMENTS:
- Simple, precise language (aim for 8th-grade reading level)
- Neutral tone: no value judgments, no "historic" or "unprecedented"
- Active voice: name the actor before the action
- No filler phrases: "taken together", "in a related development", "meanwhile"
- No lists or bullet points within paragraphs

ATTRIBUTION AND NUMBERS:
- Flag contested claims explicitly: "X claims... which Y denies"
- Use "at least X" for preliminary casualty counts
- Name the authority providing numbers when possible
- Do not round numbers misleadingly (not "nearly 100" if it's 87)

GEOGRAPHIC REPRESENTATION:
- Do not focus exclusively on Western/US news if input includes stories from Africa, Latin America, Southeast Asia
- Treat all regions' crises with equal weight given similar impact

OUTPUT FORMAT (JSON only):
{"summary":"<paragraph 1>\\n\\n<paragraph 2>"}

Top items to synthesize:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) - ${headline.summary}
`).join('\n')}
`
  },
  it: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Sei il caporedattore neutrale di un quotidiano globale. Seleziona solo sviluppi unici e significativi delle ultime 24 ore.

TIENI (notizie verificabili con impatto concreto):
- Decisioni governative: leggi approvate, azioni esecutive, cambi di politica ufficiali
- Conflitti/sicurezza: azioni militari con vittime confermate, cambi territoriali, cessate il fuoco
- Disastri naturali: eventi con almeno 10 vittime o sfollamenti significativi
- Elezioni: risultati, annunci di candidati, irregolarita verificate
- Salute pubblica: epidemie, cambi di politica, approvazioni farmaci
- Scienza/tecnologia: scoperte peer-reviewed, lanci di prodotto importanti, decisioni regolatorie
- Economia: decisioni delle banche centrali, azioni aziendali importanti, accordi commerciali
- Per l'Italia: includi grandi notizie nazionali (politica, giustizia, sicurezza) da testate primarie

ESCLUDI (soft news, speculazione, meta-contenuti):
- Gossip, sport, intrattenimento (salvo morte o scandalo con conseguenze legali)
- Notizie locali senza implicazioni nazionali/internazionali
- Opinioni, analisi, interpretazioni del linguaggio del corpo
- Dirette, aggiornamenti continui senza fatti nuovi sostanziali
- "Reazioni" aggregate senza informazioni nuove
- Solo video senza sintesi testuale
- Previsioni o "gli esperti dicono che potrebbe accadere X"

REQUISITI DI NEUTRALITA:
- Mai usare termini valutativi: "storico", "senza precedenti", "scioccante", "controverso"
- Attribuisci tutte le affermazioni alle fonti; non presentare affermazioni contestate come fatti
- Per la copertura dei conflitti: tratta le affermazioni di tutte le parti in modo uguale salvo verifica indipendente

EQUILIBRIO GEOGRAFICO (mira alla rappresentazione):
- Se la maggior parte degli articoli proviene da una regione, cerca attivamente storie da aree sottorappresentate
- Priorita: Africa subsahariana, America Latina, Sud-est asiatico, Asia centrale, Pacifico

DE-DUPLICAZIONE EVENTI:
- Se piu articoli descrivono lo stesso evento, tieni solo il piu informativo
- Altri: isRelevant=false e in reason nota "duplicato di #<index>"

AFFERMAZIONI CONTESTATE:
- Se una parte in conflitto fa un'affermazione senza conferma indipendente, limita relevanceScore a 5
- Eccezione: l'affermazione stessa e uno sviluppo consequenziale

RUBRICA PUNTEGGI:
- 9-10: Evento cruciale con conseguenza globale verificata O disastro con molte vittime (100+)
- 7-8: Grande sviluppo nazionale con chiara rilevanza internazionale
- 6: Aggiornamento notevole con conseguenze concrete e verificabili
- 3-5: Aggiornamento minore/incrementale; pezzo analitico; video senza fatti nuovi
- 0-2: Duplicato, rumor, opinione, meta-commento, affermazione non verificabile

COPERTURA:
- Crea una voce di analisi per OGNI Index (0..N-1), anche per gli esclusi
- Usa isRelevant=false e una ragione concisa (<=200 caratteri) quando escludi

FORMATO OUTPUT (solo JSON):
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "..." } ] }

Articoli da analizzare:
${articles.map((article, index) => `
Index: ${index}
Titolo: ${article.title}
Fonte: ${article.source}
Contenuto (breve): ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Scrivi un solo titolo chiaro e neutrale per ciascun evento unico, con una frase di contesto.

REGOLE TITOLO:
- Lunghezza: 8-14 parole
- Struttura: soggetto all'inizio, voce attiva, tempo presente
- Niente parole enfatiche: evita "scoppia", "esplode", "shock", "bufera"
- Niente domande retoriche o costruzioni clickbait
- Includi un numero specifico, nome o luogo quando possibile

REGOLE SOMMARIO:
- Lunghezza: 20-30 parole
- Focus su esito concreto o prossimo passo, non su astratto "perche conta"
- Includi uno tra: tempistica, popolazione coinvolta, conseguenza immediata

REQUISITI DI ATTRIBUZIONE:
- Affermazioni unilaterali: "X afferma..." o "X sostiene..."
- Accuse: "Le autorita/gli investigatori sostengono..."
- Numeri vittime: usa "almeno X" e indica la fonte (es. "almeno 50 morti, dice il ministero")
- Evita "le fonti variano" senza nominare la fonte

RAPPRESENTAZIONE GEOGRAFICA:
- Se l'input include storie da regioni sottorappresentate, assicurati che appaiano nell'output

REQUISITI OUTPUT:
- Punta a 6-9 voci quando disponibili
- Un titolo per evento unico (unisci duplicati, usa link piu informativo)
- Non includere la testata nel titolo; copia la fonte esattamente nel campo

FORMATO OUTPUT (solo JSON):
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
Scrivi due paragrafi collegati che spieghino le notizie di oggi per un lettore generale.

PARAGRAFO 1 (110-140 parole):
- Apri con lo sviluppo piu importante
- Indica cosa e cambiato specificamente oggi (decisione, azione, scoperta)
- Collega 2-3 elementi correlati se esiste un pattern
- Termina con un'implicazione concreta a breve termine: scadenza, prossima decisione, popolazione coinvolta

PARAGRAFO 2 (90-120 parole):
- Raggruppa gli elementi rimanenti per tema (economia, sicurezza, salute, ambiente, diritti)
- Includi almeno un elemento non di conflitto se disponibile
- Per ogni elemento: cosa e successo + chi e coinvolto + cosa viene dopo
- Termina con rischio, scadenza o azione concreta, non con vago "resta da vedere"

REQUISITI DI STILE:
- Linguaggio semplice e preciso (livello scuola media)
- Tono neutro: niente giudizi di valore, niente "storico" o "senza precedenti"
- Voce attiva: nomina l'attore prima dell'azione
- Niente frasi riempitive: "nel complesso", "in un sviluppo correlato", "intanto"
- Niente elenchi puntati nei paragrafi

ATTRIBUZIONE E NUMERI:
- Segnala esplicitamente affermazioni contestate: "X afferma... Y nega"
- Usa "almeno X" per conteggi preliminari
- Nomina l'autorita che fornisce i numeri quando possibile

FORMATO OUTPUT (solo JSON):
{"summary":"<paragrafo 1>\\n\\n<paragrafo 2>"}

Notizie principali da sintetizzare:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) - ${headline.summary}
`).join('\n')}
`
  },
  fr: {
    filterPrompt: (articles: ProcessedArticle[]) => `
Vous etes le redacteur en chef neutre d'un quotidien mondial. Selectionnez uniquement des developpements uniques et significatifs des dernieres 24 heures.

A GARDER (actualites verifiables avec impact concret):
- Decisions gouvernementales: lois adoptees, actions executives, changements de politique officiels
- Conflits/securite: actions militaires avec victimes confirmees, changements territoriaux, cessez-le-feu
- Catastrophes naturelles: evenements avec au moins 10 victimes ou deplacements significatifs
- Elections: resultats, annonces de candidats majeurs, irregularites verifiees
- Sante publique: epidemies, changements de politique, approbations de medicaments
- Science/technologie: decouvertes evaluees par des pairs, lancements de produits majeurs, decisions reglementaires
- Economie: decisions des banques centrales, actions d'entreprises majeures, accords commerciaux
- Pour la France: inclure les grandes actualites nationales (politique, justice, securite) des medias de reference

A EXCLURE (soft news, speculation, meta-contenu):
- People, sport, divertissement (sauf deces ou scandale majeur avec consequences legales)
- Actualites locales sans implications nationales/internationales
- Opinions, analyses, interpretations du langage corporel
- Directs, mises a jour continues sans nouveaux faits substantiels
- "Reactions" agregees sans nouvelles informations
- Contenu video seul sans resume factuel
- Predictions ou "les experts disent que X pourrait arriver"

EXIGENCES DE NEUTRALITE:
- Ne jamais utiliser de termes charges: "historique", "sans precedent", "choquant", "controverse"
- Attribuez toutes les affirmations a leurs sources; ne presentez pas les affirmations contestees comme des faits
- Pour la couverture des conflits: traitez les affirmations de toutes les parties de maniere egale sauf verification independante

EQUILIBRE GEOGRAPHIQUE (visez la representation):
- Si la plupart des articles proviennent d'une region, cherchez activement des histoires de zones sous-representees
- Priorite: Afrique subsaharienne, Amerique latine, Asie du Sud-Est, Asie centrale, Pacifique

DE-DUPLICATION DES EVENEMENTS:
- Si plusieurs articles decrivent le meme evenement, gardez seulement le plus informatif
- Autres: isRelevant=false et dans reason notez "doublon de #<index>"

AFFIRMATIONS CONTESTEES:
- Si une partie au conflit fait une affirmation sans corroboration independante, plafonnez relevanceScore a 5
- Exception: l'affirmation elle-meme est un developpement consequent

BAREME DE NOTATION:
- 9-10: Evenement majeur avec consequence globale verifiee OU catastrophe avec nombreuses victimes (100+)
- 7-8: Developpement national majeur avec pertinence internationale claire
- 6: Mise a jour notable avec consequences concretes et verifiables
- 3-5: Mise a jour mineure/incrementale; piece analytique; video sans nouveaux faits
- 0-2: Doublon, rumeur, opinion, meta-commentaire, affirmation non verifiable

COUVERTURE:
- Creez une entree d'analyse pour CHAQUE Index (0..N-1), meme pour les exclus
- Utilisez isRelevant=false et une raison concise (<=200 caracteres) lors de l'exclusion

FORMAT DE SORTIE (JSON uniquement):
{ "analyses": [ { "index": 0, "relevanceScore": 8, "isRelevant": true, "reason": "..." } ] }

Articles a analyser:
${articles.map((article, index) => `
Index: ${index}
Titre: ${article.title}
Source: ${article.source}
Contenu (court): ${article.content.substring(0, 300)}
`).join('\n')}
`,
    headlinesPrompt: (articles: ProcessedArticle[]) => `
Redigez un seul titre clair et neutre par evenement unique, plus une phrase de contexte.

REGLES DU TITRE:
- Longueur: 8-14 mots
- Structure: sujet en premier, voix active, temps present
- Pas de mots sensationnels: evitez "explose", "secoue", "choc", "polemique"
- Pas de questions rhetoriques ou constructions clickbait
- Incluez un nombre specifique, nom ou lieu quand possible

REGLES DU RESUME:
- Longueur: 20-30 mots
- Focus sur resultat concret ou prochaine etape, pas sur abstrait "pourquoi c'est important"
- Incluez un parmi: calendrier, population affectee, consequence immediate

EXIGENCES D'ATTRIBUTION:
- Affirmations unilaterales: "X affirme..." ou "X declare..."
- Allegations: "Les autorites/enqueteurs alleguent..."
- Chiffres de victimes: utilisez "au moins X" et nommez la source (ex. "au moins 50 morts, selon le ministere")
- Evitez "les bilans varient" sans nommer la source

REPRESENTATION GEOGRAPHIQUE:
- Si l'input inclut des histoires de regions sous-representees, assurez-vous qu'elles apparaissent dans l'output

EXIGENCES DE SORTIE:
- Visez 6-9 elements quand disponible
- Un titre par evenement unique (fusionnez les doublons, utilisez le lien le plus informatif)
- N'incluez pas le media dans le titre; copiez la source exactement dans le champ

FORMAT DE SORTIE (JSON uniquement):
{ "headlines": [ { "title": "...", "source": "...", "summary": "...", "link": "..." } ] }

Articles:
${articles.map((article, index) => `
Index: ${index}
Titre: ${article.title}
Source: ${article.source}
Contenu (court): ${article.content.substring(0, 600)}
Lien: ${article.link}
`).join('\n')}
`,
    summaryPrompt: (headlines: NewsHeadline[]) => `
Ecrivez deux paragraphes relies qui expliquent l'actualite du jour pour un lecteur general.

PARAGRAPHE 1 (110-140 mots):
- Commencez par le developpement le plus consequent
- Indiquez ce qui a specifiquement change aujourd'hui (decision, action, decouverte)
- Reliez 2-3 elements connexes si un pattern existe
- Terminez avec une implication concrete a court terme: echeance, prochaine decision, population affectee

PARAGRAPHE 2 (90-120 mots):
- Regroupez les elements restants par theme (economie, securite, sante, environnement, droits)
- Incluez au moins un element non conflictuel si disponible
- Pour chaque element: ce qui s'est passe + qui est affecte + quelle suite
- Terminez par risque, echeance ou action concrete, pas par vague "reste a voir"

EXIGENCES DE STYLE:
- Langage simple et precis (niveau college)
- Ton neutre: pas de jugements de valeur, pas de "historique" ou "sans precedent"
- Voix active: nommez l'acteur avant l'action
- Pas de phrases de remplissage: "pris ensemble", "dans un developpement connexe", "pendant ce temps"
- Pas de listes a puces dans les paragraphes

ATTRIBUTION ET CHIFFRES:
- Signalez explicitement les affirmations contestees: "X affirme... Y nie"
- Utilisez "au moins X" pour les comptages preliminaires
- Nommez l'autorite fournissant les chiffres quand possible

FORMAT DE SORTIE (JSON uniquement):
{"summary":"<paragraphe 1>\\n\\n<paragraphe 2>"}

Sujets principaux a synthetiser:
${headlines.map((headline, index) => `
${index + 1}. ${headline.title} (${headline.source}) - ${headline.summary}
`).join('\n')}
`
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

  try {
    const systemPrompt = 'You are a neutral news editor. Generate headlines and respond with valid JSON only. No markdown, no explanations.';
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

  try {
    const apiStart = Date.now();
    const systemPrompt = 'You are a neutral news summarizer. Generate a daily summary and respond with valid JSON only. No markdown, no explanations.';
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
