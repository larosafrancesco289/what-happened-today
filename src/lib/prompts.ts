import type { ProcessedArticle, NewsHeadline } from '@/types/news';

/**
 * All LLM prompt text lives here so tone and wording can be iterated in one place,
 * separate from the pipeline logic in llm-client.ts.
 */

export type SupportedPromptLang = 'en' | 'it' | 'fr';

/** A story handed to the summary prompt: the headline plus the lead article's body text. */
export interface SummaryStory {
  title: string;
  summary: string;
  /** Lead article body (truncated) so the model writes from real material, not just blurbs. */
  body?: string;
}

export function getPrompts(languageCode: string): typeof LANGUAGE_PROMPTS[SupportedPromptLang] {
  return LANGUAGE_PROMPTS[(languageCode as SupportedPromptLang)] ?? LANGUAGE_PROMPTS.en;
}

export function getSystemPrompt(languageCode: string, role: 'headlines' | 'summary'): string {
  const lang = (languageCode as SupportedPromptLang);
  return SYSTEM_PROMPTS[lang]?.[role] ?? SYSTEM_PROMPTS.en[role];
}

const SYSTEM_PROMPTS: Record<SupportedPromptLang, { headlines: string; summary: string }> = {
  en: {
    headlines: 'You are a neutral news editor. Write all headlines and summaries in English. Output valid JSON only.',
    summary: 'You are a neutral news writer. Write the summary in plain English. Output valid JSON only.',
  },
  it: {
    headlines: 'Sei un redattore neutrale. Scrivi TUTTI i titoli e sommari in ITALIANO. Output solo JSON valido.',
    summary: 'Sei un giornalista neutrale. Scrivi il riassunto in ITALIANO semplice e chiaro. Output solo JSON valido.',
  },
  fr: {
    headlines: 'Vous êtes un rédacteur neutre. Écrivez TOUS les titres et résumés en FRANÇAIS. Output JSON valide uniquement.',
    summary: 'Vous êtes un journaliste neutre. Rédigez le résumé en FRANÇAIS simple et clair. Output JSON valide uniquement.',
  },
};

/**
 * Format articles for inclusion in headline prompts.
 * Shared across all language prompts to avoid duplicating the covering-articles logic.
 */
function formatArticlesForPrompt(articles: ProcessedArticle[], alsoLabel: string): string {
  return articles.map((a, i) => {
    let entry = `[${i}] ARTICLE_ID: ${i}\nSource: ${a.source}\nTitle: ${a.title}${a.coveringSources ? ` [${alsoLabel}: ${a.coveringSources.join(', ')}]` : ''}\nPublished: ${a.publishedAt}\n${a.content.substring(0, 600)}\nLink: ${a.link}`;
    if (a.coveringArticles && a.coveringArticles.length > 0) {
      entry += '\n' + a.coveringArticles.map(ca => `${ca.source} version (300 chars):\nPublished: ${ca.publishedAt}\n${ca.content.substring(0, 300)}\nLink: ${ca.link}`).join('\n');
    }
    return entry;
  }).join('\n\n');
}

/**
 * Format a "yesterday headlines" section for memory/continuity.
 * Returns an empty string when there are no yesterday headlines.
 */
function formatYesterdayMemory(yesterdayHeadlines: NewsHeadline[], header: string, instructions: string): string {
  if (yesterdayHeadlines.length === 0) return '';
  return `\n${header}:\n${yesterdayHeadlines.map((h, i) => `${i + 1}. ${h.title}`).join('\n')}\n${instructions}\n\n`;
}

/**
 * Format a "yesterday context" section for summary prompts.
 * Returns an empty string when there are no yesterday headlines.
 */
function formatYesterdayContext(yesterdayHeadlines: NewsHeadline[], header: string): string {
  if (yesterdayHeadlines.length === 0) return '';
  return `\n${header}:\n${yesterdayHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h.title}`).join('\n')}\n\n`;
}

/** Render the "today's stories" block for a summary prompt, including lead-article body text. */
function formatSummaryStories(stories: SummaryStory[]): string {
  return stories
    .map((s, i) => {
      const head = `${i + 1}. ${s.title} — ${s.summary}`;
      return s.body ? `${head}\n   Source text: ${s.body}` : head;
    })
    .join('\n\n');
}

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
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\nPublished: ${a.publishedAt}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        "YESTERDAY'S HEADLINES (continuity only — today's edition must still stand alone)",
        'Use these only to recognize ongoing stories. If an ongoing story is still important today, include enough context for a reader who skipped yesterday. Use the "developing" tier only when today has a concrete new development.'
      );

      return `Create headlines + summaries for distinct news events. Write in clear, factual English.

TIER SYSTEM — Generate 8-15 headlines in 3 tiers:
- "top" (2-4): Day's most important events, full detailed summaries
- "also" (3-6): Important but not lead stories, shorter summaries
- "developing" (0-3): Ongoing stories that remain important today, with today's concrete update and enough context to stand alone
If fewer than 8 stories meet the quality threshold, produce fewer. Never pad with marginal stories.
${memorySection}
HEADLINE RULES:
- 8-14 words, active voice, present tense for today's events
- Subject-Verb-Object structure (WHO did WHAT to WHOM)
- NO sensational words: slams, blasts, rocks, shock, stunning, chaos, crisis (unless literal)
- NO question headlines or cliffhangers
- Include specific numbers when available (casualties, amounts, percentages)

SUMMARY RULES:
- 25-40 words covering: What happened, Who is affected, What happens next
- Include specific numbers, dates, or locations when relevant
- State the significance: why this matters to readers

MULTI-SOURCE: When input articles have coveringSources, include all sources in a "sources" array field.

SINGLE-SOURCE: If an article has NO [Also: ...] annotation, include "singleSource": true in the JSON.

	FRAMING: For multi-source stories, add a "framings" array showing how each source approached the story.
	Each framing: {"source":"AP","angle":"Led with casualty figures and blast mechanics","link":"..."}
	The angle should be 8-15 words describing what the source emphasized, NOT an opinion about the source.

	SOURCE INTEGRITY:
	- Use only stories from the provided ARTICLES list.
	- Choose the primary ARTICLE_ID and return it as numeric "articleIndex".
	- Copy the primary article "Link" exactly into "link".
	- Copy the primary article "Published" timestamp exactly into "publishedAt".
	- Do not invent links, dates, sources, names, or numbers.

	IMPORTANT: Each story must appear in exactly ONE tier. Do not place the same event in both "top" and "developing".

	OUTPUT JSON FORMAT:
	{"headlines":[{"articleIndex":0,"title":"...","source":"PrimarySource","sources":["Source1","Source2"],"summary":"...","link":"...","publishedAt":"...","tier":"top","framings":[{"source":"AP","angle":"...","link":"..."}]},{"articleIndex":1,"title":"...","source":"SingleSource","summary":"...","link":"...","publishedAt":"...","tier":"also","singleSource":true},{"articleIndex":2,"title":"...","source":"...","summary":"...","link":"...","publishedAt":"...","tier":"developing","dayNumber":3,"previousContext":"Fighting shifted from X to Y"},...]}

ARTICLES:
${formatArticlesForPrompt(articles, 'Also')}`;
    },

    summaryPrompt: (stories: SummaryStory[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        "YESTERDAY'S CONTEXT (continuity only — today's briefing must be complete for readers who skipped yesterday)"
      );

      return `Write today's daily news briefing: 3-4 short paragraphs, about 330-360 words — a 90-second read. A reader should understand the day's most important developments and actually enjoy reading it. Never pad past ~380 words.

VOICE — write like a sharp, well-informed friend catching someone up:
- Clear, plain, human language. Short, concrete sentences over long abstract ones.
- Lead the reader from one fact to the next. Use natural connective tissue, and say plainly why something matters ("which matters because…", "the upshot:").
- Name real people, places, and numbers. Prefer the specific over the vague.
- Stay neutral and calm: no hype, no clickbait, no loaded adjectives, no opinions of your own. The warmth comes from clarity and flow, NOT from drama or editorializing.
- Describe what happened, not its presumed intent or emotional effect, unless a named source says so.
- When sources or actors disagree, give both sides in a sentence.
- Plain text only — no Markdown, no headings, no bullet lists.

WHAT TO COVER:
- Paragraph 1: the single most important story, with enough context to understand it on its own.
- Paragraphs 2-3: weave together the next most significant developments — the ~5-7 that matter most, grouping related events. Do NOT try to mention every story; the headline list below the summary carries the rest. Explaining a few stories well beats listing many.
${yesterdaySection}
Here is an example of the VOICE and LENGTH we want (about 340 words, four short paragraphs). It is from a different day — copy the tone, rhythm, and length, never its content:
"""
Floodwaters across northern Vietnam pushed past records today, and the human cost is coming into focus: at least 60 people have died and tens of thousands have left their homes as the Red River keeps rising. Hanoi has opened emergency shelters and moved soldiers in to shore up dykes, but officials say the worst may still be ahead, with more rain forecast through the weekend. Neighboring Laos has begun evacuating villages along the same river system.

The economic news was quieter but matters for anyone with a mortgage. The US Federal Reserve held interest rates steady for a third straight meeting, signaling it wants firmer proof that inflation is cooling before it cuts. Markets had expected the move, and stocks barely budged. Europe is heading the other way — the European Central Bank hinted it could cut as soon as next month, a sign the world's two big central banks are drifting apart, which tends to push the euro lower against the dollar.

Two political stories are worth watching. In South Africa, the governing coalition survived a no-confidence vote, easing months of doubt over whether it would hold together. And in Japan, the government laid out a plan to nearly double defense spending over five years — a quiet but real shift for a country that has kept its military small since World War II, and one its neighbors will study closely.

Finally, some better news for public health: regulators in the EU approved a new malaria vaccine for children, the second to reach the market in three years. Trials showed it cut severe cases by about two-thirds, and the maker says it can produce enough doses to reach several million children across Africa by next year, where most malaria deaths still occur.
"""

TODAY'S STORIES (each includes the lead article's source text — draw concrete facts from it):
${formatSummaryStories(stories)}

Output JSON: {"summary":"<your briefing here>"}`;
    }
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
- Titoli con parole sensazionalistiche: "shock", "clamoroso", "bomba", "incredibile", "assurdo", "caos", "crisi" (salvo uso letterale), "attacca", "tuona", "scuote", "drammatico", "sconvolgente"

REQUISITI DI DIVERSITÀ:
- Se lo stesso evento è coperto da più fonti, tieni la versione più completa
- Punta alla diversità geografica: includi storie da diverse regioni del mondo
- Preferisci notizie verificate da 2+ fonti per breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICOLI:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\nPublished: ${a.publishedAt}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        'TITOLI DI IERI (solo per continuità — l\'edizione di oggi deve restare autonoma)',
        'Usali solo per riconoscere le storie in corso. Se una storia in corso è ancora importante oggi, includi abbastanza contesto per chi non ha letto ieri. Usa il livello "developing" solo quando oggi c\'è uno sviluppo concreto nuovo.'
      );

      return `IMPORTANTE: Scrivi TUTTO in italiano.

Crea titoli + sommari per ogni notizia distinta. Scrivi in italiano chiaro e fattuale.

SISTEMA A LIVELLI — Genera 8-15 titoli in 3 livelli:
- "top" (2-4): Le notizie più importanti del giorno, sommari dettagliati completi
- "also" (3-6): Importanti ma non di apertura, sommari più brevi
- "developing" (0-3): Storie in corso ancora importanti oggi, con l'aggiornamento concreto di oggi e contesto sufficiente
Se meno di 8 storie raggiungono la soglia di qualità, producine meno. Non aggiungere mai storie marginali.
${memorySection}
REGOLE PER I TITOLI:
- 8-14 parole, voce attiva, tempo presente per eventi di oggi
- Struttura Soggetto-Verbo-Oggetto (CHI ha fatto COSA a CHI)
- NO parole sensazionalistiche: shock, clamoroso, bomba, incredibile, assurdo, caos, crisi (salvo uso letterale), attacca, tuona, scuote, drammatico, sconvolgente
- NO titoli con domande o cliffhanger
- Includi numeri specifici quando disponibili (vittime, importi, percentuali)

REGOLE PER I SOMMARI:
- 25-40 parole che coprono: Cosa è successo, Chi è coinvolto, Cosa succede dopo
- Includi numeri specifici, date o luoghi quando rilevanti
- Spiega il significato: perché interessa ai lettori

MULTI-FONTE: Quando gli articoli in input hanno coveringSources, includi tutte le fonti in un campo array "sources".

FONTE UNICA: Se un articolo NON ha annotazione [Anche: ...], includi "singleSource": true nel JSON.

	FRAMING: Per le storie multi-fonte, aggiungi un array "framings" che mostri come ogni fonte ha trattato la notizia.
	Ogni framing: {"source":"ANSA","angle":"Ha aperto con le cifre delle vittime e la meccanica dell'esplosione","link":"..."}
	L'angle deve essere di 8-15 parole che descrivono cosa la fonte ha enfatizzato, NON un'opinione sulla fonte.

	INTEGRITÀ DELLE FONTI:
	- Usa solo notizie presenti nella lista ARTICOLI.
	- Scegli l'ARTICLE_ID primario e restituiscilo come numero nel campo "articleIndex".
	- Copia esattamente il "Link" dell'articolo primario nel campo "link".
	- Copia esattamente il timestamp "Published" dell'articolo primario nel campo "publishedAt".
	- Non inventare link, date, fonti, nomi o numeri.

	Descrivi i fatti, non caratterizzarli. Invece di 'video razzista', descrivi il contenuto del video e lascia giudicare il lettore.

	IMPORTANTE: Ogni notizia deve apparire in UN SOLO livello. Non inserire lo stesso evento sia in "top" che in "developing".

	FORMATO JSON OUTPUT:
	{"headlines":[{"articleIndex":0,"title":"...","source":"FontePrincipale","sources":["Fonte1","Fonte2"],"summary":"...","link":"...","publishedAt":"...","tier":"top","framings":[{"source":"ANSA","angle":"...","link":"..."}]},{"articleIndex":1,"title":"...","source":"FonteUnica","summary":"...","link":"...","publishedAt":"...","tier":"also","singleSource":true},{"articleIndex":2,"title":"...","source":"...","summary":"...","link":"...","publishedAt":"...","tier":"developing","dayNumber":3,"previousContext":"I combattimenti si sono spostati da X a Y"},...]}

ARTICOLI:
${formatArticlesForPrompt(articles, 'Anche')}`;
    },

    summaryPrompt: (stories: SummaryStory[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        'CONTESTO DI IERI (solo per continuità — il briefing di oggi deve essere completo per chi non ha letto ieri)'
      );

      return `Scrivi il briefing quotidiano di oggi IN ITALIANO: 3-4 paragrafi brevi, circa 330-360 parole — una lettura da 90 secondi. Il lettore deve capire gli sviluppi più importanti del giorno e leggere con piacere. Non superare mai ~380 parole.

VOCE — scrivi come un amico sveglio e bene informato che ti aggiorna:
- Lingua chiara, semplice, umana. Frasi brevi e concrete invece che lunghe e astratte.
- Accompagna il lettore da un fatto al successivo. Usa transizioni naturali e spiega con semplicità perché una cosa conta ("il che conta perché…", "in sostanza:").
- Nomina persone, luoghi e numeri reali. Preferisci il concreto al vago.
- Resta neutrale e calmo: niente sensazionalismo, niente clickbait, niente aggettivi carichi, nessuna opinione tua. Il calore viene dalla chiarezza e dal ritmo, NON dal dramma o dall'editorializzazione.
- Descrivi cosa è successo, non l'intenzione presunta o l'effetto emotivo, a meno che lo dica una fonte citata.
- Quando fonti o attori sono in disaccordo, riporta entrambe le posizioni in una frase.
- Solo testo semplice — niente Markdown, niente titoli, niente elenchi puntati.

COSA COPRIRE:
- Paragrafo 1: la singola notizia più importante, con abbastanza contesto per capirla da sola.
- Paragrafi 2-4: intreccia gli sviluppi più rilevanti successivi — i ~5-7 che contano di più, raggruppando eventi correlati. NON cercare di citare ogni storia; l'elenco dei titoli sotto il riassunto copre il resto. Spiegare bene poche storie è meglio che elencarne molte.
${yesterdaySection}
Ecco un esempio della VOCE e LUNGHEZZA che vogliamo (circa 340 parole, quattro paragrafi brevi). È di un altro giorno — copia il tono, il ritmo e la lunghezza, mai il contenuto:
"""
Le inondazioni nel nord del Vietnam hanno superato oggi ogni record, e il bilancio umano si fa più chiaro: almeno 60 morti e decine di migliaia di sfollati mentre il Fiume Rosso continua a salire. Hanoi ha aperto rifugi d'emergenza e schierato l'esercito per rinforzare gli argini, ma le autorità avvertono che il peggio potrebbe ancora arrivare, con altra pioggia prevista nel fine settimana. Anche il vicino Laos ha iniziato a evacuare i villaggi lungo lo stesso fiume.

La notizia economica è più scommessa ma riguarda chiunque abbia un mutuo. La Federal Reserve statunitense ha lasciato i tassi invariati per la terza riunione di fila, segnalando di volere prove più solide del rallentamento dell'inflazione prima di tagliare. I mercati se lo aspettavano e le borse si sono mosse poco. L'Europa va nella direzione opposta: la Banca centrale europea ha lasciato intendere un possibile taglio già il mese prossimo, segno che le due grandi banche centrali si stanno allontanando, il che tende a indebolire l'euro sul dollaro.

Due storie politiche da seguire. In Sudafrica la coalizione di governo ha superato un voto di sfiducia, allentando mesi di dubbi sulla sua tenuta. E in Giappone il governo ha presentato un piano per quasi raddoppiare la spesa per la difesa in cinque anni — un cambiamento discreto ma reale per un Paese che ha tenuto piccolo il proprio esercito dalla Seconda guerra mondiale, e che i vicini osserveranno da vicino.

Infine, una notizia migliore per la sanità pubblica: i regolatori dell'UE hanno approvato un nuovo vaccino antimalarico per bambini, il secondo ad arrivare sul mercato in tre anni. I test hanno ridotto i casi gravi di circa due terzi e il produttore dice di poter fare abbastanza dosi da raggiungere diversi milioni di bambini in Africa entro un anno, dove avviene la maggior parte delle morti per malaria.
"""

NOTIZIE DI OGGI (ognuna include il testo della fonte — trai fatti concreti da esso):
${formatSummaryStories(stories)}

Output JSON: {"summary":"<il tuo briefing qui>"}`;
    }
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
- Titres avec mots sensationnels: "choc", "incroyable", "scandaleux", "stupéfiant", "hallucinant", "chaos", "crise" (sauf usage littéral), "fustige", "torpille", "secoue", "dramatique", "bouleversant"

EXIGENCES DE DIVERSITÉ:
- Si le même événement est couvert par plusieurs sources, gardez la version la plus complète
- Visez la diversité géographique: incluez des histoires de différentes régions du monde
- Préférez les nouvelles vérifiées par 2+ sources pour les breaking news

OUTPUT: {"analyses":[{"index":0,"relevanceScore":8,"isRelevant":true,"reason":"..."},...]}

ARTICLES:
${articles.map((a, i) => `[${i}] ${a.source}: ${a.title}\nPublished: ${a.publishedAt}\n${a.content.substring(0, 300)}`).join('\n\n')}`,

    headlinesPrompt: (articles: ProcessedArticle[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const memorySection = formatYesterdayMemory(
        yesterdayHeadlines,
        "TITRES D'HIER (continuité uniquement — l'édition d'aujourd'hui doit rester autonome)",
        'Utilisez-les seulement pour reconnaître les sujets en cours. Si un sujet en cours reste important aujourd\'hui, incluez assez de contexte pour une personne qui n\'a pas lu hier. Utilisez le niveau "developing" seulement quand il existe un développement concret nouveau aujourd\'hui.'
      );

      return `IMPORTANT: Écrivez TOUT en français.

Créez titres + résumés par événement distinct. Écrivez en français clair et factuel.

SYSTÈME DE NIVEAUX — Générez 8-15 titres en 3 niveaux:
- "top" (2-4): Les événements les plus importants du jour, résumés détaillés complets
- "also" (3-6): Importants mais pas en une, résumés plus courts
- "developing" (0-3): Sujets en cours encore importants aujourd'hui, avec le développement concret du jour et assez de contexte
Si moins de 8 sujets atteignent le seuil de qualité, produisez-en moins. Ne remplissez jamais avec des sujets marginaux.
${memorySection}
RÈGLES POUR LES TITRES:
- 8-14 mots, voix active, présent pour les événements du jour
- Structure Sujet-Verbe-Objet (QUI a fait QUOI à QUI)
- PAS de mots sensationnels: choc, incroyable, scandaleux, stupéfiant, hallucinant, chaos, crise (sauf usage littéral), fustige, torpille, secoue, dramatique, bouleversant
- PAS de titres interrogatifs ou de cliffhangers
- Incluez des chiffres spécifiques quand disponibles (victimes, montants, pourcentages)

RÈGLES POUR LES RÉSUMÉS:
- 25-40 mots couvrant: Ce qui s'est passé, Qui est concerné, Quelle suite
- Incluez des chiffres spécifiques, dates ou lieux quand pertinents
- Expliquez la signification: pourquoi cela intéresse les lecteurs

MULTI-SOURCE: Quand les articles en entrée ont coveringSources, incluez toutes les sources dans un champ tableau "sources".

SOURCE UNIQUE: Si un article n'a PAS d'annotation [Aussi: ...], incluez "singleSource": true dans le JSON.

	FRAMING: Pour les histoires multi-sources, ajoutez un tableau "framings" montrant comment chaque source a traité l'info.
	Chaque framing: {"source":"AFP","angle":"A ouvert avec les chiffres des victimes et la mécanique de l'explosion","link":"..."}
	L'angle doit faire 8-15 mots décrivant ce que la source a mis en avant, PAS une opinion sur la source.

	INTÉGRITÉ DES SOURCES:
	- Utilisez uniquement les sujets présents dans la liste ARTICLES.
	- Choisissez l'ARTICLE_ID principal et renvoyez-le comme nombre dans "articleIndex".
	- Copiez exactement le "Link" de l'article principal dans "link".
	- Copiez exactement l'horodatage "Published" de l'article principal dans "publishedAt".
	- N'inventez pas de liens, dates, sources, noms ou chiffres.

	Décrivez les faits, ne les caractérisez pas. Au lieu de 'vidéo raciste', décrivez le contenu et laissez le lecteur juger.

	IMPORTANT: Chaque événement doit apparaître dans UN SEUL niveau. Ne placez pas le même événement dans "top" et "developing".

	FORMAT JSON OUTPUT:
	{"headlines":[{"articleIndex":0,"title":"...","source":"SourcePrincipale","sources":["Source1","Source2"],"summary":"...","link":"...","publishedAt":"...","tier":"top","framings":[{"source":"AFP","angle":"...","link":"..."}]},{"articleIndex":1,"title":"...","source":"SourceUnique","summary":"...","link":"...","publishedAt":"...","tier":"also","singleSource":true},{"articleIndex":2,"title":"...","source":"...","summary":"...","link":"...","publishedAt":"...","tier":"developing","dayNumber":3,"previousContext":"Les combats se sont déplacés de X à Y"},...]}

ARTICLES:
${formatArticlesForPrompt(articles, 'Aussi')}`;
    },

    summaryPrompt: (stories: SummaryStory[], yesterdayHeadlines: NewsHeadline[] = []) => {
      const yesterdaySection = formatYesterdayContext(
        yesterdayHeadlines,
        "CONTEXTE D'HIER (continuité uniquement — le briefing d'aujourd'hui doit être complet pour les lecteurs qui ont sauté hier)"
      );

      return `Rédigez le briefing quotidien d'aujourd'hui EN FRANÇAIS : 3-4 paragraphes courts, environ 330-360 mots — une lecture de 90 secondes. Le lecteur doit comprendre les développements les plus importants du jour et prendre plaisir à lire. Ne dépassez jamais ~380 mots.

VOIX — écrivez comme un ami vif et bien informé qui fait le point :
- Langue claire, simple, humaine. Des phrases courtes et concrètes plutôt que longues et abstraites.
- Menez le lecteur d'un fait au suivant. Utilisez des transitions naturelles et dites simplement pourquoi une chose compte ("ce qui compte parce que…", "en clair :").
- Nommez des personnes, lieux et chiffres réels. Préférez le concret au vague.
- Restez neutre et calme : pas de sensationnalisme, pas de clickbait, pas d'adjectifs chargés, aucune opinion personnelle. La chaleur vient de la clarté et du rythme, PAS du drame ni de l'éditorialisation.
- Décrivez ce qui s'est passé, pas l'intention présumée ni l'effet émotionnel, sauf si une source citée le dit.
- Quand les sources ou acteurs sont en désaccord, exposez les deux positions en une phrase.
- Texte brut uniquement — pas de Markdown, pas de titres, pas de listes à puces.

QUOI COUVRIR :
- Paragraphe 1 : l'événement le plus important, avec assez de contexte pour le comprendre seul.
- Paragraphes 2-4 : tissez ensemble les développements suivants les plus marquants — les ~5-7 qui comptent le plus, en regroupant les événements liés. N'essayez PAS de citer chaque sujet ; la liste des titres sous le résumé couvre le reste. Mieux vaut bien expliquer quelques sujets que d'en énumérer beaucoup.
${yesterdaySection}
Voici un exemple de la VOIX et de la LONGUEUR souhaitées (environ 340 mots, quatre paragraphes courts). Il vient d'un autre jour — copiez le ton, le rythme et la longueur, jamais le contenu :
"""
Les inondations dans le nord du Vietnam ont battu des records aujourd'hui, et le bilan humain se précise : au moins 60 morts et des dizaines de milliers de personnes déplacées alors que le fleuve Rouge continue de monter. Hanoï a ouvert des refuges d'urgence et déployé l'armée pour renforcer les digues, mais les autorités préviennent que le pire est peut-être à venir, avec d'autres pluies prévues ce week-end. Le Laos voisin a aussi commencé à évacuer des villages le long du même fleuve.

La nouvelle économique était plus discrète mais concerne quiconque a un crédit immobilier. La Réserve fédérale américaine a laissé ses taux inchangés pour la troisième réunion d'affilée, signalant qu'elle veut des preuves plus solides du ralentissement de l'inflation avant de baisser. Les marchés s'y attendaient et les Bourses ont peu bougé. L'Europe prend le chemin inverse : la Banque centrale européenne a laissé entendre une baisse possible dès le mois prochain, signe que les deux grandes banques centrales s'éloignent, ce qui tend à affaiblir l'euro face au dollar.

Deux sujets politiques à suivre. En Afrique du Sud, la coalition au pouvoir a survécu à un vote de défiance, dissipant des mois de doutes sur sa solidité. Et au Japon, le gouvernement a présenté un plan pour presque doubler les dépenses de défense en cinq ans — un changement discret mais réel pour un pays qui a gardé une armée réduite depuis la Seconde Guerre mondiale, et que ses voisins observeront de près.

Enfin, une meilleure nouvelle pour la santé publique : les régulateurs de l'UE ont approuvé un nouveau vaccin antipaludique pour enfants, le deuxième à arriver sur le marché en trois ans. Les essais ont réduit les cas graves d'environ deux tiers, et le fabricant dit pouvoir produire assez de doses pour atteindre plusieurs millions d'enfants en Afrique d'ici un an, où surviennent la plupart des décès dus au paludisme.
"""

ACTUALITÉS DU JOUR (chacune inclut le texte de la source — tirez-en des faits concrets):
${formatSummaryStories(stories)}

Output JSON: {"summary":"<votre briefing ici>"}`;
    }
  }
};

/** System prompt for the categorization step. */
export const CATEGORIZE_SYSTEM_PROMPT =
  'You are a news categorization system. Analyze headlines and respond with valid JSON only. No markdown, no explanations.';

/** Prompt that tags each headline with category, region, and importance. */
export function categorizePrompt(headlines: NewsHeadline[]): string {
  return `Categorize each headline by topic, region, and importance. Output JSON only.

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

OUTPUT: {"categories":[{"index":0,"category":"conflict","region":"europe","importance":"breaking"},...]}`;
}
