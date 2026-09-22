import { expect, test } from 'bun:test';
import { clusterArticles, pickCandidates } from './cluster';
import type { Article } from './fetch';

const article = (source: string, title: string, hour = 10): Article => ({
  source,
  title,
  excerpt: '',
  link: `https://example.com/${source}/${encodeURIComponent(title)}`,
  publishedAt: `2026-09-22T${String(hour).padStart(2, '0')}:00:00.000Z`,
});

test('groups the same story across outlets', () => {
  const clusters = clusterArticles([
    article('BBC', 'Typhoon Dujuan kills five in Japan'),
    article('Guardian', 'Japan: Typhoon Dujuan death toll rises to five'),
    article('NPR', 'Senate passes budget bill'),
  ]);
  expect(clusters.map(c => c.map(a => a.source).sort())).toEqual([['BBC', 'Guardian'], ['NPR']]);
});

test('ranks multi-outlet stories first and caps single-outlet stories per outlet', () => {
  const busy = ['Floods in Pakistan', 'Chile elects president', 'Kenya raises taxes', 'Norway oil fund sells', 'Brazil court ruling', 'Canada wildfire season']
    .map((title, i) => article('DW', title, 12 + i));
  const shared = [article('BBC', 'Typhoon Dujuan kills five'), article('NPR', 'Typhoon Dujuan kills five people')];
  const picked = pickCandidates(clusterArticles([...busy, ...shared]));

  expect(picked[0].map(a => a.source).sort()).toEqual(['BBC', 'NPR']);
  expect(picked.filter(c => c[0].source === 'DW')).toHaveLength(4);
});
