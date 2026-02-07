'use client';

import { useState, useMemo } from 'react';
import { DailyNews, NewsHeadline, Category, Region } from '@/types/news';
import { formatDate } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import type { Translations } from '@/lib/i18n';
import { RSS_FEEDS_BY_LANGUAGE } from '@/lib/languages';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { categoryIcons } from '@/lib/category-icons';

interface NewsSummaryProps {
  data: DailyNews;
}

function sourceLabel(headline: NewsHeadline): string {
  if (headline.sources && headline.sources.length > 1) {
    return headline.sources.join(', ');
  }
  return headline.source;
}

interface HeadlineFooterProps {
  headline: NewsHeadline;
  readMoreLabel: string;
  translations: Translations;
}

function HeadlineFooter({ headline, readMoreLabel, translations }: HeadlineFooterProps) {
  const isSingle = headline.singleSource === true || (headline.sources?.length ?? 1) <= 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border-light/40 dark:border-border-dark/40">
      <span className="byline">
        {sourceLabel(headline)}
        {isSingle && (
          <span className="text-xs not-italic text-subtle-light/60 dark:text-subtle-dark/60 ml-2">
            ({translations.pipeline?.singleSource || 'Single source'})
          </span>
        )}
      </span>
      <a
        href={headline.link}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-outline inline-flex items-center gap-2 text-accent2-light dark:text-accent2-dark hover:text-accent-light dark:hover:text-accent-dark font-medium text-sm transition-all duration-300 group/link border-accent-hover"
      >
        <span>{readMoreLabel}</span>
        <ArrowTopRightOnSquareIcon className="w-4 h-4 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
      </a>
    </div>
  );
}

interface FramingSectionProps {
  headline: NewsHeadline;
  translations: Translations;
}

function FramingSection({ headline, translations: t }: FramingSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!headline.framings || headline.framings.length < 2) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-subtle-light/70 dark:text-subtle-dark/70 hover:text-text-light dark:hover:text-text-dark transition-colors group/framing"
      >
        <EyeIcon className="w-3.5 h-3.5" />
        <span>{t.framing.title}</span>
        <ChevronDownIcon className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-400 ease-out ${isOpen ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'}`}>
        <div className="space-y-2 pl-4 border-l-2 border-border-light/40 dark:border-border-dark/40">
          {headline.framings.map((f, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              <span className="font-medium text-text-light dark:text-text-dark whitespace-nowrap">{f.source}</span>
              <span className="text-subtle-light dark:text-subtle-dark">{f.angle}</span>
              {f.link && (
                <a
                  href={f.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-accent2-light dark:text-accent2-dark hover:text-accent-light dark:hover:text-accent-dark"
                >
                  <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const importanceStyles: Record<string, { border: string; badge: string; size: 'featured' | 'major' | 'standard' }> = {
  breaking: {
    border: 'border-l-4 border-l-red-500 dark:border-l-red-400',
    badge: 'bg-red-500 dark:bg-red-500 text-white pulse-breaking',
    size: 'featured'
  },
  major: {
    border: 'border-l-4 border-l-accent-light dark:border-l-accent-dark',
    badge: 'bg-accent-light dark:bg-accent-dark text-white',
    size: 'major'
  },
  notable: {
    border: '',
    badge: '',
    size: 'standard'
  },
};

function CategoryFilter({
  headlines,
  selectedCategory,
  onSelect,
  translations,
}: {
  headlines: NewsHeadline[];
  selectedCategory: Category | null;
  onSelect: (category: Category | null) => void;
  translations: ReturnType<typeof getTranslations>;
}) {
  const categories = useMemo(() => {
    const cats = new Set<Category>();
    headlines.forEach(h => {
      if (h.category) cats.add(h.category);
    });
    return Array.from(cats);
  }, [headlines]);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-10">
      <button
        onClick={() => onSelect(null)}
        className={`px-5 py-2.5 rounded-sm text-sm font-medium transition-all duration-300 border ${
          !selectedCategory
            ? 'bg-text-light dark:bg-text-dark text-bg-light dark:text-bg-dark border-text-light dark:border-text-dark'
            : 'bg-transparent text-subtle-light dark:text-subtle-dark border-border-light dark:border-border-dark hover:border-text-light dark:hover:border-text-dark hover:text-text-light dark:hover:text-text-dark'
        }`}
      >
        {translations.categories?.all || 'All'}
      </button>
      {categories.map((category, idx) => {
        const Icon = categoryIcons[category];
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            style={{ animationDelay: `${(idx + 1) * 0.05}s` }}
            className={`px-5 py-2.5 rounded-sm text-sm font-medium transition-all duration-300 flex items-center gap-2 border animate-fade-in animate-hidden ${
              selectedCategory === category
                ? 'bg-text-light dark:bg-text-dark text-bg-light dark:text-bg-dark border-text-light dark:border-text-dark'
                : 'bg-transparent text-subtle-light dark:text-subtle-dark border-border-light dark:border-border-dark hover:border-text-light dark:hover:border-text-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" strokeWidth={1.5} />}
            <span>{translations.categories?.[category] || category}</span>
          </button>
        );
      })}
    </div>
  );
}

interface HeadlineCardProps {
  headline: NewsHeadline;
  index: number;
  isFirst: boolean;
  compact?: boolean;
}

function HeadlineCard({ headline, index, isFirst, compact = false }: HeadlineCardProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  const importance = headline.importance || 'notable';
  const styles = importanceStyles[importance];
  const CategoryIcon = headline.category ? categoryIcons[headline.category] : null;

  const isFeatured = !compact && isFirst && importance !== 'notable';

  return (
    <article
      className={`animate-fade-in-up animate-hidden ${isFeatured ? 'md:col-span-2' : ''}`}
      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
    >
      <div className={`group relative h-full bg-panel-light dark:bg-panel-dark border border-border-light/60 dark:border-border-dark/60 ${styles.border} transition-all duration-500 hover:border-border-light dark:hover:border-border-dark card-editorial`}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-light dark:via-border-dark to-transparent" />

        <div className={compact ? 'p-4 lg:p-5' : `p-6 lg:p-8 ${isFeatured ? 'lg:p-10' : ''}`}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {headline.category && CategoryIcon && (
              <span className="section-label flex items-center gap-1.5">
                <CategoryIcon className="w-3.5 h-3.5" strokeWidth={2} />
                <span>{t.categories?.[headline.category] || headline.category}</span>
              </span>
            )}

            {headline.region && (
              <>
                <span className="text-border-light dark:text-border-dark">|</span>
                <span className="text-xs text-subtle-light dark:text-subtle-dark uppercase tracking-wide">
                  {t.regions?.[headline.region] || headline.region}
                </span>
              </>
            )}

            {headline.sources && headline.sources.length > 1 && (
              <>
                <span className="text-border-light dark:text-border-dark">|</span>
                <span className="bg-border-light/30 dark:bg-border-dark/30 text-subtle-light dark:text-subtle-dark text-xs rounded-sm px-2 py-0.5">
                  {headline.sources.length} {t.pipeline?.sourcePlural || 'sources'}
                </span>
              </>
            )}

            <div className="flex-1" />

            {(importance === 'breaking' || importance === 'major') && (
              <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${styles.badge}`}>
                {t.importance?.[importance] || importance}
              </span>
            )}
          </div>

          <h3 className={`font-serif font-semibold text-text-light dark:text-text-dark leading-tight mb-4 group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors duration-300 ${
            compact ? 'text-lg lg:text-xl' : isFeatured ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'
          }`}>
            {headline.title}
          </h3>

          <p className={`text-subtle-light dark:text-subtle-dark leading-relaxed mb-5 ${
            compact ? 'text-sm' : isFeatured ? 'text-base lg:text-lg' : 'text-base'
          }`}>
            {headline.summary}
          </p>

          <HeadlineFooter headline={headline} readMoreLabel={t.summary.readMore} translations={t} />
          <FramingSection headline={headline} translations={t} />
        </div>
      </div>
    </article>
  );
}

interface DevelopingCardProps {
  headline: NewsHeadline;
  index: number;
}

function DevelopingCard({ headline, index }: DevelopingCardProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  return (
    <article
      className="animate-fade-in-up animate-hidden"
      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
    >
      <div className="group relative bg-panel-light dark:bg-panel-dark border border-border-light/60 dark:border-border-dark/60 border-l-4 border-l-amber-500 dark:border-l-amber-400 transition-all duration-500 hover:border-border-light dark:hover:border-border-dark card-editorial">
        <div className="p-4 lg:p-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-shrink-0 flex flex-wrap gap-2">
            {headline.dayNumber && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-sm">
                {t.continuity?.day || 'Day'} {headline.dayNumber}
              </span>
            )}
            {headline.sources && headline.sources.length > 1 && (
              <span className="bg-border-light/30 dark:bg-border-dark/30 text-subtle-light dark:text-subtle-dark text-xs rounded-sm px-2 py-0.5 inline-flex items-center">
                {headline.sources.length} {t.pipeline?.sourcePlural || 'sources'}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold text-lg text-text-light dark:text-text-dark leading-tight mb-2 group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors duration-300">
              {headline.title}
            </h3>

            {headline.previousContext && (
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                <span className="font-medium">{t.continuity?.updated || 'Updated'}:</span> {headline.previousContext}
              </p>
            )}

            <p className="text-sm text-subtle-light dark:text-subtle-dark leading-relaxed mb-3">
              {headline.summary}
            </p>

            <HeadlineFooter headline={headline} readMoreLabel={t.summary.readMore} translations={t} />
            <FramingSection headline={headline} translations={t} />
          </div>
        </div>
      </div>
    </article>
  );
}

const perspectiveColors: Record<string, string> = {
  left: 'bg-blue-500',
  'center-left': 'bg-sky-400',
  center: 'bg-gray-400 dark:bg-gray-500',
  'center-right': 'bg-orange-400',
  right: 'bg-red-500',
};

function SourcesFooter({ headlines, translations, languageCode }: { headlines: NewsHeadline[]; translations: ReturnType<typeof getTranslations>; languageCode: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const feedLookup = useMemo(() => {
    const feeds = RSS_FEEDS_BY_LANGUAGE[languageCode] || RSS_FEEDS_BY_LANGUAGE.en || [];
    const map = new Map<string, { type?: string; perspective?: string }>();
    for (const feed of feeds) {
      map.set(feed.name, { type: feed.type, perspective: feed.perspective });
    }
    return map;
  }, [languageCode]);

  const sources = useMemo(() => {
    const sourceSet = new Set<string>();
    headlines.forEach(h => sourceSet.add(h.source));
    return Array.from(sourceSet).sort();
  }, [headlines]);

  return (
    <div className="mt-16 lg:mt-20">
      <div className="editorial-rule mb-8" />

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="section-label group-hover:text-text-light dark:group-hover:text-text-dark transition-colors">
          {translations.sources?.title || "Today's Sources"} ({sources.length})
        </span>
        <ChevronDownIcon
          className={`w-5 h-5 text-subtle-light dark:text-subtle-dark transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ease-out ${
          isExpanded ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="py-6 border-t border-border-light/40 dark:border-border-dark/40">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
            {sources.map((source, idx) => {
              const info = feedLookup.get(source);
              const typeLabel = info?.type ? translations.pipeline?.sourceType?.[info.type] || info.type : null;
              const perspectiveLabel = info?.perspective ? translations.pipeline?.sourcePerspective?.[info.perspective] || info.perspective : null;
              const dotColor = info?.perspective ? perspectiveColors[info.perspective] || 'bg-gray-400' : null;

              return (
                <li
                  key={source}
                  className="flex items-start gap-3 text-sm text-subtle-light dark:text-subtle-dark animate-fade-in animate-hidden"
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  {dotColor ? (
                    <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0 mt-1.5`} title={perspectiveLabel || undefined} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-accent-light dark:bg-accent-dark flex-shrink-0 mt-1.5" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-text-light dark:text-text-dark">{source}</span>
                    {(typeLabel || perspectiveLabel) && (
                      <div className="text-xs text-subtle-light/70 dark:text-subtle-dark/70 mt-0.5">
                        {[typeLabel, perspectiveLabel].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-6 text-xs text-subtle-light/70 dark:text-subtle-dark/70 max-w-2xl">
            {translations.sources?.disclaimer ||
              'Stories are sourced from multiple outlets representing diverse geographic and editorial perspectives. Summaries are AI-generated for neutrality and clarity.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NewsSummary({ data }: NewsSummaryProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const summaryParagraphs = data.summary.split('\n\n');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const filteredHeadlines = useMemo(() => {
    if (!selectedCategory) return data.headlines;
    return data.headlines.filter(h => h.category === selectedCategory);
  }, [data.headlines, selectedCategory]);

  // Group headlines by tier with backward compatibility
  const { topStories, alsoToday, developing } = useMemo(() => {
    const hasTiers = filteredHeadlines.some(h => h.tier);

    if (hasTiers) {
      return {
        topStories: filteredHeadlines.filter(h => h.tier === 'top'),
        alsoToday: filteredHeadlines.filter(h => h.tier === 'also'),
        developing: filteredHeadlines.filter(h => h.tier === 'developing'),
      };
    }

    // Backward compat: old data without tiers — first 3 as top, rest as also
    return {
      topStories: filteredHeadlines.slice(0, 3),
      alsoToday: filteredHeadlines.slice(3),
      developing: [] as NewsHeadline[],
    };
  }, [filteredHeadlines]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      {/* Masthead */}
      <header className="text-center mb-16 lg:mb-24 pt-8 animate-fade-in-up">
        {/* Decorative top rule */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="h-px w-20 bg-border-light dark:bg-border-dark" />
          <div className="w-2 h-2 rotate-45 border border-accent-light dark:border-accent-dark" />
          <div className="h-px w-20 bg-border-light dark:bg-border-dark" />
        </div>

        <h1 className="headline-editorial headline-xl text-text-light dark:text-text-dark mb-6">
          {t.summary.title}
        </h1>

        <div className="flex items-center justify-center gap-6">
          <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-border-light dark:to-border-dark" />
          <time className="text-lg sm:text-xl lg:text-2xl text-subtle-light dark:text-subtle-dark font-light tracking-wide">
            {formatDate(data.date, currentLanguage.code)}
          </time>
          <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-border-light dark:to-border-dark" />
        </div>

        {/* Decorative bottom element */}
        <div className="mt-8 flex justify-center">
          <div className="w-16 h-0.5 bg-accent-light dark:bg-accent-dark" />
        </div>
      </header>

      {/* Pipeline transparency stats */}
      {data.metadata && (
        <div className="text-center mb-12 lg:mb-16 animate-fade-in stagger-1 animate-hidden">
          <p className="text-sm text-subtle-light/70 dark:text-subtle-dark/70 tracking-wide">
            {t.pipeline?.filterRatio
              .replace('{stories}', String(data.headlines.length))
              .replace('{articles}', String(data.metadata.articlesProcessed))
              .replace('{sources}', String(data.metadata.sourcesUsed))}
          </p>

          {data.metadata.regionCounts && Object.keys(data.metadata.regionCounts).length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <span className="text-xs text-subtle-light/50 dark:text-subtle-dark/50 uppercase tracking-wider mr-1">
                {t.pipeline?.regionCoverage || 'Coverage today'}
              </span>
              {(Object.entries(data.metadata.regionCounts) as [Region, number][])
                .filter(([, count]) => count > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([region, count]) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-border-light/20 dark:bg-border-dark/20 text-subtle-light dark:text-subtle-dark rounded-sm"
                  >
                    <span>{t.regions?.[region] || region}</span>
                    <span className="text-subtle-light/50 dark:text-subtle-dark/50">{count}</span>
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Daily Summary Section */}
      <section className="mb-20 lg:mb-28 animate-fade-in-up stagger-2 animate-hidden">
        <div className="flex items-center gap-4 mb-8">
          <span className="section-label">{t.summary.dailySummary}</span>
          <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
        </div>

        <div className="space-y-6">
          {summaryParagraphs.map((paragraph: string, index: number) => (
            <p
              key={index}
              className={`text-text-light dark:text-text-dark text-lg lg:text-xl leading-relaxed summary-text ${
                index === 0 ? 'drop-cap' : ''
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Headlines Section */}
      <section>
        <div className="flex items-center gap-4 mb-8 animate-fade-in-up stagger-3 animate-hidden">
          <span className="section-label">{t.summary.headlines}</span>
          <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
        </div>

        <CategoryFilter
          headlines={data.headlines}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          translations={t}
        />

        {/* Top Stories — 2-column grid */}
        {topStories.length > 0 && (
          <div className="mb-12 lg:mb-16">
            <div className="flex items-center gap-4 mb-6">
              <span className="section-label">{t.tiers?.topStories || 'Top Stories'}</span>
              <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {topStories.map((headline: NewsHeadline, index: number) => (
                <HeadlineCard
                  key={`top-${index}`}
                  headline={headline}
                  index={index}
                  isFirst={index === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* Also Today — 3-column grid, compact cards */}
        {alsoToday.length > 0 && (
          <div className="mb-12 lg:mb-16">
            <div className="flex items-center gap-4 mb-6">
              <span className="section-label">{t.tiers?.alsoToday || 'Also Today'}</span>
              <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {alsoToday.map((headline: NewsHeadline, index: number) => (
                <HeadlineCard
                  key={`also-${index}`}
                  headline={headline}
                  index={index}
                  isFirst={false}
                  compact
                />
              ))}
            </div>
          </div>
        )}

        {/* Developing — vertical list with day badges */}
        {developing.length > 0 && (
          <div className="mb-12 lg:mb-16">
            <div className="flex items-center gap-4 mb-6">
              <span className="section-label">{t.tiers?.developing || 'Developing'}</span>
              <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
            </div>
            <div className="flex flex-col gap-4">
              {developing.map((headline: NewsHeadline, index: number) => (
                <DevelopingCard
                  key={`dev-${index}`}
                  headline={headline}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {filteredHeadlines.length === 0 && (
          <div className="text-center py-16 text-subtle-light dark:text-subtle-dark">
            <p className="font-serif text-xl italic">{t.summary.noHeadlines || 'No headlines in this category.'}</p>
          </div>
        )}

        <SourcesFooter headlines={data.headlines} translations={t} languageCode={currentLanguage.code} />
      </section>
    </div>
  );
}
