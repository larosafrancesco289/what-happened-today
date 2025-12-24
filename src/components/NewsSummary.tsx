'use client';

import { useState, useMemo } from 'react';
import { DailyNews, NewsHeadline, Category } from '@/types/news';
import { formatDate } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { Swords, Landmark, TrendingUp, FlaskConical, Globe, Users, LucideIcon } from 'lucide-react';

interface NewsSummaryProps {
  data: DailyNews;
}

const categoryConfig: Record<Category, { icon: LucideIcon; labelKey: string }> = {
  conflict: { icon: Swords, labelKey: 'conflict' },
  politics: { icon: Landmark, labelKey: 'politics' },
  economy: { icon: TrendingUp, labelKey: 'economy' },
  science: { icon: FlaskConical, labelKey: 'science' },
  environment: { icon: Globe, labelKey: 'environment' },
  society: { icon: Users, labelKey: 'society' },
};

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
        const Icon = categoryConfig[category]?.icon;
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

function HeadlineCard({ headline, index, isFirst }: { headline: NewsHeadline; index: number; isFirst: boolean }) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  const importance = headline.importance || 'notable';
  const styles = importanceStyles[importance];
  const CategoryIcon = headline.category ? categoryConfig[headline.category]?.icon : null;

  const isFeatured = isFirst && importance !== 'notable';

  return (
    <article
      className={`animate-fade-in-up animate-hidden ${isFeatured ? 'md:col-span-2' : ''}`}
      style={{ animationDelay: `${0.1 + index * 0.08}s` }}
    >
      <div className={`group relative h-full bg-panel-light dark:bg-panel-dark border border-border-light/60 dark:border-border-dark/60 ${styles.border} transition-all duration-500 hover:border-border-light dark:hover:border-border-dark card-editorial`}>
        {/* Accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-light dark:via-border-dark to-transparent" />

        <div className={`p-6 lg:p-8 ${isFeatured ? 'lg:p-10' : ''}`}>
          {/* Top row: Category + Source + Importance */}
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

            <div className="flex-1" />

            {importance === 'breaking' && (
              <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${styles.badge}`}>
                {t.importance?.breaking || 'Breaking'}
              </span>
            )}
            {importance === 'major' && (
              <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${styles.badge}`}>
                {t.importance?.major || 'Major'}
              </span>
            )}
          </div>

          {/* Headline title */}
          <h3 className={`font-serif font-semibold text-text-light dark:text-text-dark leading-tight mb-4 group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors duration-300 ${
            isFeatured ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'
          }`}>
            {headline.title}
          </h3>

          {/* Summary */}
          <p className={`text-subtle-light dark:text-subtle-dark leading-relaxed mb-5 ${
            isFeatured ? 'text-base lg:text-lg' : 'text-base'
          }`}>
            {headline.summary}
          </p>

          {/* Bottom row: Source + Read more */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border-light/40 dark:border-border-dark/40">
            <span className="byline">
              {headline.source}
            </span>

            <a
              href={headline.link}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-outline inline-flex items-center gap-2 text-accent2-light dark:text-accent2-dark hover:text-accent-light dark:hover:text-accent-dark font-medium text-sm transition-all duration-300 group/link border-accent-hover"
            >
              <span>{t.summary.readMore}</span>
              <ArrowTopRightOnSquareIcon className="w-4 h-4 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function SourcesFooter({ headlines, translations }: { headlines: NewsHeadline[]; translations: ReturnType<typeof getTranslations> }) {
  const [isExpanded, setIsExpanded] = useState(false);

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
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="py-6 border-t border-border-light/40 dark:border-border-dark/40">
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
            {sources.map((source, idx) => (
              <li
                key={source}
                className="flex items-center gap-2.5 text-sm text-subtle-light dark:text-subtle-dark animate-fade-in animate-hidden"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <span className="w-1 h-1 rounded-full bg-accent-light dark:bg-accent-dark flex-shrink-0" />
                <span className="font-medium">{source}</span>
              </li>
            ))}
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

        {/* Newspaper-style grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {filteredHeadlines.map((headline: NewsHeadline, index: number) => (
            <HeadlineCard
              key={index}
              headline={headline}
              index={index}
              isFirst={index === 0}
            />
          ))}
        </div>

        {filteredHeadlines.length === 0 && (
          <div className="text-center py-16 text-subtle-light dark:text-subtle-dark">
            <p className="font-serif text-xl italic">{t.summary.noHeadlines || 'No headlines in this category.'}</p>
          </div>
        )}

        <SourcesFooter headlines={data.headlines} translations={t} />
      </section>
    </div>
  );
}
