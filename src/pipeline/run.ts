// Usage: bun src/pipeline/run.ts <en|it|fr>
import { isLang } from '../languages';
import { writeEdition } from '../editions';
import { fetchArticles } from './fetch';
import { clusterArticles, pickCandidates } from './cluster';
import { writeStories } from './write';

const MIN_ARTICLES = 30;

const lang = process.argv[2] ?? '';
if (!isLang(lang)) throw new Error(`Usage: bun src/pipeline/run.ts <en|it|fr> (got "${lang}")`);
if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');

const now = new Date();
const date = now.toISOString().slice(0, 10);
console.log(`Edition ${lang} ${date}`);

console.log('Fetching feeds');
const articles = await fetchArticles(lang, now);
if (articles.length < MIN_ARTICLES) {
  throw new Error(`Only ${articles.length} fresh articles; feeds are likely broken`);
}

const candidates = pickCandidates(clusterArticles(articles));
console.log(`${articles.length} articles → ${candidates.length} candidate stories`);

console.log('Writing edition');
const { model, summary, headlines } = await writeStories(lang, candidates);

writeEdition(lang, {
  date,
  summary,
  headlines,
  metadata: { model, articles: articles.length, candidates: candidates.length, generatedAt: now.toISOString() },
});
console.log(`Saved data/${lang}/${date}.json: ${headlines.length} stories, ${summary.split(/\s+/).length}-word briefing`);
