'use client';

import { DailyNews, NewsHeadline } from '@/types/news';
import { formatDate } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface NewsSummaryProps {
  data: DailyNews;
}

function HeadlineCard({ headline }: { headline: NewsHeadline }) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  
  return (
    <article className="group relative">
      <div className="absolute inset-0 bg-accent2-light/10 dark:bg-accent2-dark/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-panel-light/80 dark:bg-panel-dark/80 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl p-6 lg:p-8 hover:shadow-card dark:hover:shadow-cardDark hover:border-border-light dark:hover:border-border-dark transition-all duration-500 ease-out hover:-translate-y-1">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <h3 className="text-lg lg:text-xl font-semibold text-text-light dark:text-text-dark leading-tight transition-colors flex-1">
              {headline.title}
            </h3>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-muted-light dark:bg-muted-dark text-text-light dark:text-text-dark border border-border-light/60 dark:border-border-dark/60">
                {headline.source}
              </span>
            </div>
          </div>
          
          <p className="text-subtle-light dark:text-subtle-dark leading-relaxed text-base lg:text-lg font-light">
            {headline.summary}
          </p>
          
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

export default function NewsSummary({ data }: NewsSummaryProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const summaryParagraphs = data.summary.split('\n\n');

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
            {currentLanguage.code === 'it' ? 'Riassunto Giornaliero' : 'Daily Summary'}
          </h2>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-accent2-light/5 dark:bg-accent2-dark/5 rounded-xl" />
          <div className="relative bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl p-8 lg:p-12 space-y-8 shadow-card dark:shadow-cardDark">
            {summaryParagraphs.map((paragraph: string, index: number) => (
              <p key={index} className="text-subtle-light dark:text-subtle-dark leading-relaxed text-lg lg:text-xl font-light">
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
        
        <div className="grid gap-6 lg:gap-8">
          {data.headlines.map((headline: NewsHeadline, index: number) => (
            <HeadlineCard key={index} headline={headline} />
          ))}
        </div>
      </section>
    </div>
  );
} 