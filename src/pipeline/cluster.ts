import type { Article } from './fetch';

/** A group of articles that appear to cover the same story; the first is the lead. */
export type Candidate = Article[];

const MAX_CANDIDATES = 40;
const MAX_SINGLE_SOURCE_PER_OUTLET = 4;

// Common 4+ letter words in en/it/fr titles that say nothing about the story.
const STOPWORDS = new Set([
  'about', 'after', 'amid', 'from', 'have', 'into', 'more', 'over', 'said', 'says', 'than', 'that',
  'their', 'this', 'what', 'will', 'with', 'year', 'years', 'first', 'news', 'live', 'could', 'would',
  'anche', 'come', 'della', 'delle', 'dello', 'degli', 'dopo', 'nella', 'nelle', 'alla', 'alle', 'sono',
  'questo', 'questa', 'oggi', 'tutti', 'dall', 'nell', 'dell', 'sull', 'contro', 'mentre', 'ecco',
  'apres', 'avec', 'cette', 'dans', 'leur', 'mais', 'pour', 'plus', 'sont', 'selon', 'entre', 'face',
  'direct', 'fait', 'nous', 'vous', 'elle', 'tout', 'sans', 'sous',
]);

function keywords(title: string): Set<string> {
  const words = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 4 && !STOPWORDS.has(word));
  return new Set(words);
}

function sameStory(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const word of a) if (b.has(word)) shared++;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.5;
}

function outletCount(candidate: Candidate): number {
  return new Set(candidate.map(article => article.source)).size;
}

/** Group articles by shared title keywords, newest first within each group. */
export function clusterArticles(articles: Article[]): Candidate[] {
  const groups: { keys: Set<string>; articles: Article[] }[] = [];
  const newestFirst = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  for (const article of newestFirst) {
    const keys = keywords(article.title);
    const group = groups.find(g => sameStory(g.keys, keys));
    if (group) group.articles.push(article);
    else groups.push({ keys, articles: [article] });
  }

  return groups.map(g => g.articles);
}

/**
 * Stories covered by more outlets rank first; among the rest, newest first.
 * Single-outlet stories are capped per outlet so one busy feed can't crowd out the others.
 */
export function pickCandidates(candidates: Candidate[]): Candidate[] {
  const ranked = [...candidates].sort((a, b) =>
    outletCount(b) - outletCount(a) || b[0].publishedAt.localeCompare(a[0].publishedAt));

  const singlesPerOutlet = new Map<string, number>();
  return ranked
    .filter(candidate => {
      if (outletCount(candidate) > 1) return true;
      const count = singlesPerOutlet.get(candidate[0].source) ?? 0;
      singlesPerOutlet.set(candidate[0].source, count + 1);
      return count < MAX_SINGLE_SOURCE_PER_OUTLET;
    })
    .slice(0, MAX_CANDIDATES);
}
