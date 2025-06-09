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
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-white/80 dark:bg-slate-800/80 glass border border-slate-200/60 dark:border-slate-700/60 rounded-2xl p-6 lg:p-8 hover:shadow-xl hover:shadow-slate-200/20 dark:hover:shadow-slate-900/40 hover:border-slate-300/80 dark:hover:border-slate-600/80 transition-all duration-500 ease-out hover:-translate-y-1">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <h3 className="text-lg lg:text-xl font-semibold text-slate-900 dark:text-slate-100 leading-tight group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors flex-1">
              {headline.title}
            </h3>
            <div className="flex-shrink-0">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/50 dark:from-blue-900/30 dark:to-indigo-900/30 dark:text-blue-300 dark:border-blue-800/50">
                {headline.source}
              </span>
            </div>
          </div>
          
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base lg:text-lg font-light">
            {headline.summary}
          </p>
          
          <div className="pt-2">
            <a
              href={headline.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm lg:text-base transition-all duration-300 group/link hover:gap-3"
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
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
            <p className="text-xl sm:text-2xl lg:text-3xl text-slate-500 dark:text-slate-400 font-light">
              {formatDate(data.date, currentLanguage.code)}
            </p>
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-600 to-transparent" />
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <section className="mb-16 lg:mb-20">
        <div className="flex items-center gap-4 mb-8 lg:mb-12">
          <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
          <h2 className="text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {currentLanguage.code === 'it' ? 'Riassunto Giornaliero' : 'Daily Summary'}
          </h2>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl" />
          <div className="relative bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 rounded-3xl p-8 lg:p-12 space-y-8">
            {summaryParagraphs.map((paragraph: string, index: number) => (
              <p key={index} className="text-slate-700 dark:text-slate-300 leading-relaxed text-lg lg:text-xl font-light">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Headlines Section */}
      <section>
        <div className="flex items-center gap-4 mb-8 lg:mb-12">
          <div className="w-12 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" />
          <h2 className="text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-slate-100">
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