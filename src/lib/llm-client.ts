import OpenAI from 'openai';
import type { ProcessedArticle, NewsHeadline, Category, Region, Importance } from '@/types/news';

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

    headlinesPrompt: (articles: ProcessedArticle[]) => `Create one headline + summary per distinct news event. Write in clear, factual English.

HEADLINE RULES:
- 8-14 words, active voice, present tense for today's events
- Subject-Verb-Object structure (WHO did WHAT to WHOM)
- NO sensational words: slams, blasts, rocks, shock, stunning, chaos, crisis (unless literal)
- NO question headlines or cliffhangers
- Include specific numbers when available (casualties, amounts, percentages)
- For ongoing stories, focus on TODAY'S development

SUMMARY RULES:
- 25-40 words covering: What happened, Who is affected, What happens next
- Include specific numbers, dates, or locations when relevant
- State the significance: why this matters to readers
- Avoid hedging language (could, might, may) unless genuinely uncertain

EXAMPLE (GOOD):
{"title":"EU Parliament Approves Landmark AI Regulation Affecting Major Tech Companies","source":"Reuters","summary":"The European Parliament passed the AI Act, the world's first comprehensive AI law, requiring companies like OpenAI and Google to comply by 2026. Non-compliance carries fines up to 7% of global revenue.","link":"..."}

AVOID THESE PATTERNS:
- "Breaking: Shocking Development Rocks Markets" (sensational, vague)
- "Is Democracy in Danger?" (question, vague)
- "What Happened Will Surprise You" (clickbait)
- "Experts React to News" (no new facts)

OUTPUT JSON: {"headlines":[...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Write a 2-3 paragraph daily news briefing (220-300 words) that tells TODAY'S STORY. Your goal is to help readers understand the world in 90 seconds.

STRUCTURE:
Paragraph 1: Lead with the most significant global story. Connect it to broader context or ongoing developments.
Paragraph 2: Cover 2-3 other major stories, showing how they relate to each other or to larger themes when possible.
Paragraph 3: End with a forward-looking story or development that signals what's coming next.

STORYTELLING REQUIREMENTS:
- Connect events narratively: show cause and effect, parallel developments, or thematic links
- Provide context: what came before, why it matters, what it means for ordinary people
- Use transitions that show relationships: "Meanwhile", "This comes as", "The development follows"
- Name specific places, people, and numbers - be concrete, not abstract
- Write like The Economist or The Atlantic: intelligent but accessible

TONE:
- Neutral and factual, but not boring
- Present multiple perspectives when relevant
- Avoid editorializing, but contextualization is encouraged
- No sensationalism, but acknowledge significance

GOOD EXAMPLE:
{"summary":"The war in Ukraine struck Moscow's heart today when a car bomb killed Lieutenant General Igor Kirillov outside his apartment building - the highest-profile assassination inside Russia since the conflict began. The brazen hit, claimed by Ukraine's security services, signals Kyiv's growing capacity to strike deep within enemy territory even as its forces struggle to hold ground in the east.\\n\\nThe attack came hours after Russia unleashed its largest aerial barrage in weeks: 650 drones and 30 missiles targeting Ukraine's power grid, leaving millions without heat as temperatures plunge below freezing. Poland scrambled fighter jets to protect its airspace, a reminder of how the war's shockwaves extend well beyond Ukraine's borders. The tit-for-tat escalation dims already faint hopes for peace talks that both sides had hinted at in recent weeks.\\n\\nBeyond Europe, Sudan's humanitarian catastrophe deepened as the UN warned the Security Council that nearly 1,000 days of civil war have created what may be the world's worst hunger crisis, with 25 million people needing aid."}

BAD (don't do this): "Russia attacked Ukraine. A general was killed. Sudan has a humanitarian crisis." - This is just a list, not a story. No connections, no context, no narrative.

TODAY'S STORIES:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<your briefing here>"}`
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

    headlinesPrompt: (articles: ProcessedArticle[]) => `IMPORTANTE: Scrivi TUTTO in italiano.

Crea un titolo + sommario per ogni notizia distinta. Scrivi in italiano chiaro e fattuale.

REGOLE PER I TITOLI:
- 8-14 parole, voce attiva, tempo presente per eventi di oggi
- Struttura Soggetto-Verbo-Oggetto (CHI ha fatto COSA a CHI)
- NO parole sensazionalistiche: shock, clamoroso, bomba, incredibile, assurdo
- NO titoli con domande o cliffhanger
- Includi numeri specifici quando disponibili (vittime, importi, percentuali)
- Per storie in corso, concentrati sullo sviluppo di OGGI

REGOLE PER I SOMMARI:
- 25-40 parole che coprono: Cosa è successo, Chi è coinvolto, Cosa succede dopo
- Includi numeri specifici, date o luoghi quando rilevanti
- Spiega il significato: perché interessa ai lettori
- Evita linguaggio vago (potrebbe, forse) a meno che non sia genuinamente incerto

ESEMPIO (BUONO):
{"title":"Il Parlamento UE approva la storica regolamentazione sull'IA per le big tech","source":"Reuters","summary":"Il Parlamento Europeo ha approvato l'AI Act, la prima legge completa sull'intelligenza artificiale al mondo, che obbliga aziende come OpenAI e Google a conformarsi entro il 2026. La non conformità comporta multe fino al 7% del fatturato globale.","link":"..."}

PATTERN DA EVITARE:
- "Breaking: Sviluppo shock scuote i mercati" (sensazionalistico, vago)
- "La democrazia è in pericolo?" (domanda, vago)
- "Non crederai a cosa è successo" (clickbait)

OUTPUT JSON: {"headlines":[...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Scrivi un briefing quotidiano di 2-3 paragrafi (220-300 parole) IN ITALIANO che racconti la STORIA di oggi. Il tuo obiettivo è aiutare i lettori a capire il mondo in 90 secondi.

STRUTTURA:
Paragrafo 1: Apri con la storia globale più significativa. Collegala al contesto più ampio o agli sviluppi in corso.
Paragrafo 2: Copri 2-3 altre storie importanti, mostrando come si collegano tra loro o a temi più ampi quando possibile.
Paragrafo 3: Concludi con una storia o sviluppo che guarda al futuro e segnala cosa sta arrivando.

REQUISITI NARRATIVI:
- Collega gli eventi in modo narrativo: mostra causa ed effetto, sviluppi paralleli o collegamenti tematici
- Fornisci contesto: cosa è successo prima, perché conta, cosa significa per la gente comune
- Usa transizioni che mostrano relazioni: "Nel frattempo", "Questo avviene mentre", "Lo sviluppo segue"
- Nomina luoghi, persone e numeri specifici - sii concreto, non astratto
- Scrivi come The Economist o Internazionale: intelligente ma accessibile

TONO:
- Neutrale e fattuale, ma non noioso
- Presenta più prospettive quando rilevante
- Evita di editorializzare, ma la contestualizzazione è incoraggiata
- Niente sensazionalismo, ma riconosci l'importanza

BUON ESEMPIO:
{"summary":"La guerra in Ucraina ha colpito il cuore di Mosca oggi quando un'autobomba ha ucciso il Tenente Generale Igor Kirillov fuori dal suo appartamento - l'assassinio più eclatante in Russia dall'inizio del conflitto. L'attacco audace, rivendicato dai servizi segreti ucraini, segnala la crescente capacità di Kiev di colpire in profondità nel territorio nemico anche mentre le sue forze faticano a mantenere il terreno nell'est.\\n\\nL'attentato è arrivato ore dopo che la Russia ha scatenato il più grande bombardamento aereo delle ultime settimane: 650 droni e 30 missili contro la rete elettrica ucraina, lasciando milioni di persone senza riscaldamento mentre le temperature scendono sotto zero. La Polonia ha fatto decollare caccia per proteggere il suo spazio aereo, un promemoria di come le onde d'urto della guerra si estendano ben oltre i confini ucraini.\\n\\nOltre l'Europa, la catastrofe umanitaria del Sudan si è aggravata mentre l'ONU ha avvertito il Consiglio di Sicurezza che quasi 1.000 giorni di guerra civile hanno creato quella che potrebbe essere la peggiore crisi alimentare del mondo, con 25 milioni di persone bisognose di aiuti."}

MALE (non fare così): "La Russia ha attaccato l'Ucraina. Un generale è stato ucciso. Il Sudan ha una crisi umanitaria." - Questa è solo una lista, non una storia. Nessun collegamento, nessun contesto, nessuna narrativa.

NOTIZIE DI OGGI:
${headlines.map((h, i) => `${i + 1}. ${h.title} — ${h.summary}`).join('\n')}

Output JSON: {"summary":"<il tuo briefing qui>"}`
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

    headlinesPrompt: (articles: ProcessedArticle[]) => `IMPORTANT: Écrivez TOUT en français.

Créez un titre + résumé par événement distinct. Écrivez en français clair et factuel.

RÈGLES POUR LES TITRES:
- 8-14 mots, voix active, présent pour les événements du jour
- Structure Sujet-Verbe-Objet (QUI a fait QUOI à QUI)
- PAS de mots sensationnels: choc, incroyable, scandaleux, stupéfiant, hallucinant
- PAS de titres interrogatifs ou de cliffhangers
- Incluez des chiffres spécifiques quand disponibles (victimes, montants, pourcentages)
- Pour les histoires en cours, concentrez-vous sur le développement d'AUJOURD'HUI

RÈGLES POUR LES RÉSUMÉS:
- 25-40 mots couvrant: Ce qui s'est passé, Qui est concerné, Quelle suite
- Incluez des chiffres spécifiques, dates ou lieux quand pertinents
- Expliquez la signification: pourquoi cela intéresse les lecteurs
- Évitez le langage vague (pourrait, peut-être) sauf si vraiment incertain

EXEMPLE (BON):
{"title":"Le Parlement européen adopte la réglementation historique sur l'IA pour les géants tech","source":"Reuters","summary":"Le Parlement européen a adopté l'AI Act, la première loi complète sur l'intelligence artificielle au monde, obligeant des entreprises comme OpenAI et Google à se conformer d'ici 2026. La non-conformité entraîne des amendes jusqu'à 7% du chiffre d'affaires mondial.","link":"..."}

MODÈLES À ÉVITER:
- "Breaking: Développement choc secoue les marchés" (sensationnel, vague)
- "La démocratie est-elle en danger?" (question, vague)
- "Vous n'allez pas croire ce qui s'est passé" (clickbait)

OUTPUT JSON: {"headlines":[...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\n${a.content.substring(0, 600)}\nLink: ${a.link}`).join('\n\n')}`,

    summaryPrompt: (headlines: NewsHeadline[]) => `Rédigez un briefing quotidien de 2-3 paragraphes (220-300 mots) EN FRANÇAIS qui raconte l'HISTOIRE du jour. Votre objectif est d'aider les lecteurs à comprendre le monde en 90 secondes.

STRUCTURE:
Paragraphe 1: Ouvrez avec l'histoire mondiale la plus significative. Reliez-la au contexte plus large ou aux développements en cours.
Paragraphe 2: Couvrez 2-3 autres histoires majeures, en montrant comment elles se relient entre elles ou à des thèmes plus larges quand possible.
Paragraphe 3: Terminez avec une histoire ou un développement tourné vers l'avenir qui signale ce qui arrive.

EXIGENCES NARRATIVES:
- Connectez les événements de manière narrative: montrez cause et effet, développements parallèles ou liens thématiques
- Fournissez du contexte: ce qui s'est passé avant, pourquoi c'est important, ce que ça signifie pour les gens ordinaires
- Utilisez des transitions qui montrent les relations: "Pendant ce temps", "Cela survient alors que", "Ce développement fait suite à"
- Nommez des lieux, personnes et chiffres spécifiques - soyez concret, pas abstrait
- Écrivez comme The Economist ou Le Monde diplomatique: intelligent mais accessible

TON:
- Neutre et factuel, mais pas ennuyeux
- Présentez plusieurs perspectives quand pertinent
- Évitez d'éditorialiser, mais la contextualisation est encouragée
- Pas de sensationnalisme, mais reconnaissez l'importance

BON EXEMPLE:
{"summary":"La guerre en Ukraine a frappé le cœur de Moscou aujourd'hui quand une voiture piégée a tué le Lieutenant-Général Igor Kirillov devant son immeuble - l'assassinat le plus retentissant en Russie depuis le début du conflit. Cette frappe audacieuse, revendiquée par les services secrets ukrainiens, signale la capacité croissante de Kiev à frapper en profondeur en territoire ennemi alors même que ses forces peinent à tenir le terrain dans l'est.\\n\\nL'attaque est survenue quelques heures après que la Russie a déclenché son plus grand barrage aérien en plusieurs semaines: 650 drones et 30 missiles ciblant le réseau électrique ukrainien, laissant des millions de personnes sans chauffage alors que les températures plongent sous zéro. La Pologne a fait décoller des chasseurs pour protéger son espace aérien, un rappel de la façon dont les ondes de choc de la guerre s'étendent bien au-delà des frontières ukrainiennes.\\n\\nAu-delà de l'Europe, la catastrophe humanitaire au Soudan s'est aggravée alors que l'ONU a averti le Conseil de sécurité que près de 1 000 jours de guerre civile ont créé ce qui pourrait être la pire crise alimentaire au monde, avec 25 millions de personnes ayant besoin d'aide."}

MAUVAIS (ne faites pas ça): "La Russie a attaqué l'Ukraine. Un général a été tué. Le Soudan a une crise humanitaire." - C'est juste une liste, pas une histoire. Aucune connexion, aucun contexte, aucune narration.

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
    // Return empty array - the pipeline will handle this as "unavailable"
    return [];
  }
}

export async function generateDailySummary(headlines: NewsHeadline[], languageCode: string = 'en'): Promise<string> {
  // CRITICAL: Refuse to generate summary with no headlines - this causes hallucination of old news
  if (!headlines || headlines.length === 0) {
    throw new Error('Cannot generate summary: no headlines provided. This would cause the LLM to hallucinate old/fake news.');
  }

  const prompts = LANGUAGE_PROMPTS[languageCode as keyof typeof LANGUAGE_PROMPTS] || LANGUAGE_PROMPTS.en;
  const prompt = prompts.summaryPrompt(headlines);

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

    // Apply categorizations to headlines
    return headlines.map((headline, index) => {
      const categorization = result.categories?.find((c: HeadlineCategorization) => c.index === index);
      if (categorization) {
        return {
          ...headline,
          category: categorization.category,
          region: categorization.region,
          importance: categorization.importance,
        };
      }
      // Default categorization if not found
      return {
        ...headline,
        category: 'politics' as Category,
        region: 'global' as Region,
        importance: 'notable' as Importance,
      };
    });
  } catch (error) {
    console.error('Error categorizing headlines:', error);
    // Return headlines with default categorization
    return headlines.map(headline => ({
      ...headline,
      category: 'politics' as Category,
      region: 'global' as Region,
      importance: 'notable' as Importance,
    }));
  }
}
