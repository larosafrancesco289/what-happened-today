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

// Category icons and labels
const categoryConfig: Record<Category, { icon: LucideIcon; labelKey: string }> = {
  conflict: { icon: Swords, labelKey: 'conflict' },
  politics: { icon: Landmark, labelKey: 'politics' },
  economy: { icon: TrendingUp, labelKey: 'economy' },
  science: { icon: FlaskConical, labelKey: 'science' },
  environment: { icon: Globe, labelKey: 'environment' },
  society: { icon: Users, labelKey: 'society' },
};

// Importance border colors
const importanceBorderClass: Record<string, string> = {
  breaking: 'border-l-4 border-l-red-500 dark:border-l-red-400',
  major: 'border-l-4 border-l-orange-500 dark:border-l-orange-400',
  notable: '',
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
  // Get unique categories from headlines
  const categories = useMemo(() => {
    const cats = new Set<Category>();
    headlines.forEach(h => {
      if (h.category) cats.add(h.category);
    });
    return Array.from(cats);
  }, [headlines]);

  if (categories.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
          !selectedCategory
            ? 'bg-accent-light dark:bg-accent-dark text-white'
            : 'bg-muted-light dark:bg-muted-dark text-subtle-light dark:text-subtle-dark hover:bg-border-light dark:hover:bg-border-dark'
        }`}
      >
        {translations.categories?.all || 'All'}
      </button>
      {categories.map(category => {
        const Icon = categoryConfig[category]?.icon;
        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              selectedCategory === category
                ? 'bg-accent-light dark:bg-accent-dark text-white'
                : 'bg-muted-light dark:bg-muted-dark text-subtle-light dark:text-subtle-dark hover:bg-border-light dark:hover:bg-border-dark'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            <span>{translations.categories?.[category] || category}</span>
          </button>
        );
      })}
    </div>
  );
}

function HeadlineCard({ headline }: { headline: NewsHeadline }) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  const importanceClass = headline.importance ? importanceBorderClass[headline.importance] : '';
  const CategoryIcon = headline.category ? categoryConfig[headline.category]?.icon : null;

  return (
    <article className="group relative">
      <div className="absolute inset-0 bg-accent2-light/10 dark:bg-accent2-dark/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className={`relative bg-panel-light/80 dark:bg-panel-dark/80 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl p-6 lg:p-8 hover:shadow-card dark:hover:shadow-cardDark hover:border-border-light dark:hover:border-border-dark transition-all duration-500 ease-out hover:-translate-y-1 ${importanceClass}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <h3 className="text-lg lg:text-xl font-semibold text-text-light dark:text-text-dark leading-tight transition-colors flex-1">
              {headline.title}
            </h3>
            <div className="flex-shrink-0 flex items-center gap-2">
              {headline.importance === 'breaking' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                  {t.importance?.breaking || 'BREAKING'}
                </span>
              )}
              {headline.importance === 'major' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  {t.importance?.major || 'MAJOR'}
                </span>
              )}
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted-light dark:bg-muted-dark text-text-light dark:text-text-dark border border-border-light/60 dark:border-border-dark/60">
                {headline.source}
              </span>
            </div>
          </div>

          <p className="text-subtle-light dark:text-subtle-dark leading-relaxed text-base lg:text-lg font-light summary-text">
            {headline.summary}
          </p>

          {/* Category and region badges */}
          <div className="flex flex-wrap items-center gap-2">
            {headline.category && CategoryIcon && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-muted-light/50 dark:bg-muted-dark/50 text-subtle-light dark:text-subtle-dark">
                <CategoryIcon className="w-3.5 h-3.5" />
                <span className="capitalize">{headline.category}</span>
              </span>
            )}
            {headline.region && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-muted-light/50 dark:bg-muted-dark/50 text-subtle-light dark:text-subtle-dark capitalize">
                {headline.region}
              </span>
            )}
          </div>

          <div className="pt-2">
            <a
              href={headline.link}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-outline inline-flex items-center gap-2 text-accent2-light dark:text-accent2-dark hover:opacity-90 font-medium text-sm lg:text-base transition-all duration-300 group/link hover:gap-3"
            >
              {t.summary.readMore}
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
    <div className="mt-12 lg:mt-16">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-muted-light/50 dark:bg-muted-dark/50 rounded-lg border border-border-light/40 dark:border-border-dark/40 hover:bg-muted-light dark:hover:bg-muted-dark transition-colors"
      >
        <span className="font-medium text-text-light dark:text-text-dark">
          {translations.sources?.title || "Today's sources"} ({sources.length})
        </span>
        <ChevronDownIcon className={`w-5 h-5 text-subtle-light dark:text-subtle-dark transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="mt-2 p-4 bg-muted-light/30 dark:bg-muted-dark/30 rounded-lg border border-border-light/40 dark:border-border-dark/40">
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-subtle-light dark:text-subtle-dark">
            {sources.map(source => (
              <li key={source} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-light dark:bg-accent-dark" />
                {source}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle-light/70 dark:text-subtle-dark/70">
            {translations.sources?.disclaimer ||
              'Stories are sourced from multiple outlets representing diverse geographic and editorial perspectives. Summaries are AI-generated for neutrality and clarity.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function NewsSummary({ data }: NewsSummaryProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const summaryParagraphs = data.summary.split('\n\n');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Filter headlines by selected category
  const filteredHeadlines = useMemo(() => {
    if (!selectedCategory) return data.headlines;
    return data.headlines.filter(h => h.category === selectedCategory);
  }, [data.headlines, selectedCategory]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
      {/* Header Section */}
      <div className="text-center mb-16 lg:mb-20">
        <div className="space-y-6">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gradient leading-tight">
            {t.summary.title}
          </h1>
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-16 bg-border-light dark:bg-border-dark" />
            <p className="text-xl sm:text-2xl lg:text-3xl text-subtle-light dark:text-subtle-dark font-light">
              {formatDate(data.date, currentLanguage.code)}
            </p>
            <div className="h-px w-16 bg-border-light dark:bg-border-dark" />
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <section className="mb-16 lg:mb-20">
        <div className="flex items-center gap-4 mb-8 lg:mb-12">
          <div className="w-12 h-1 rounded-full bg-accent2-light dark:bg-accent2-dark" />
          <h2 className="text-2xl lg:text-3xl font-semibold text-text-light dark:text-text-dark">
            {t.summary.dailySummary}
          </h2>
        </div>

        <div className="relative group">
          <div className="absolute inset-0 bg-accent2-light/5 dark:bg-accent2-dark/5 rounded-xl" />
          <div className="relative bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl p-8 lg:p-12 space-y-8 shadow-card dark:shadow-cardDark">
            {summaryParagraphs.map((paragraph: string, index: number) => (
              <p key={index} className="text-subtle-light dark:text-subtle-dark leading-relaxed text-lg lg:text-xl font-light summary-text">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Headlines Section */}
      <section>
        <div className="flex items-center gap-4 mb-8 lg:mb-12">
          <div className="w-12 h-1 rounded-full bg-accent-light" />
          <h2 className="text-2xl lg:text-3xl font-semibold text-text-light dark:text-text-dark">
            {t.summary.headlines}
          </h2>
        </div>

        {/* Category Filter */}
        <CategoryFilter
          headlines={data.headlines}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          translations={t}
        />

        <div className="grid gap-6 lg:gap-8">
          {filteredHeadlines.map((headline: NewsHeadline, index: number) => (
            <HeadlineCard key={index} headline={headline} />
          ))}
        </div>

        {filteredHeadlines.length === 0 && (
          <div className="text-center py-12 text-subtle-light dark:text-subtle-dark">
            {t.summary.noHeadlines || 'No headlines in this category.'}
          </div>
        )}

        {/* Sources Footer */}
        <SourcesFooter headlines={data.headlines} translations={t} />
      </section>
    </div>
  );
}
