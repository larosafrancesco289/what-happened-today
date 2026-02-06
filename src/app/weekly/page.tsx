'use client';

import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import { fetchWeeklyDigest, getLastWeekId, formatDate } from '@/lib/client-utils';
import AppHeader from '@/components/AppHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { WeeklyDigest, Region } from '@/types/news';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { categoryIcons } from '@/lib/category-icons';
import Link from 'next/link';

export default function WeeklyPage() {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const [data, setData] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const digest = await fetchWeeklyDigest(getLastWeekId(), currentLanguage.code);
        setData(digest);
      } catch (err) {
        setError(t.common.error);
        console.error('Error fetching weekly digest:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentLanguage.code, t.common.error]);

  const headlinesByDate = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<string, typeof data.topHeadlines>();
    for (const h of data.topHeadlines) {
      const arr = grouped.get(h.date) || [];
      arr.push(h);
      grouped.set(h.date, arr);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const summaryParagraphs = data?.summary.split('\n\n') || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-subtle-light dark:text-subtle-dark">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">{t.weekly.title}</h1>
          <p className="text-xl text-accent2-light dark:text-accent2-dark mb-8">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-accent-light text-text-light rounded-xl hover:opacity-90 transition-colors border border-border-light"
          >
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="headline-editorial headline-xl text-text-light dark:text-text-dark mb-6">
            {t.weekly.title}
          </h1>
          <p className="text-xl text-subtle-light dark:text-subtle-dark mb-8">
            {t.weekly.noDigest}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-accent2-light dark:text-accent2-dark hover:text-accent-light dark:hover:text-accent-dark font-medium transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            {t.weekly.backToToday}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <AppHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Masthead */}
        <header className="text-center mb-16 lg:mb-24 pt-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-20 bg-border-light dark:bg-border-dark" />
            <div className="w-2 h-2 rotate-45 border border-accent-light dark:border-accent-dark" />
            <div className="h-px w-20 bg-border-light dark:bg-border-dark" />
          </div>

          <h1 className="headline-editorial headline-xl text-text-light dark:text-text-dark mb-4">
            {t.weekly.title}
          </h1>

          <p className="text-sm uppercase tracking-widest text-subtle-light/60 dark:text-subtle-dark/60 mb-6">
            {t.weekly.subtitle}
          </p>

          <div className="flex items-center justify-center gap-6">
            <div className="h-px flex-1 max-w-24 bg-gradient-to-r from-transparent to-border-light dark:to-border-dark" />
            <time className="text-lg sm:text-xl text-subtle-light dark:text-subtle-dark font-light tracking-wide">
              {formatDate(data.startDate, currentLanguage.code)} — {formatDate(data.endDate, currentLanguage.code)}
            </time>
            <div className="h-px flex-1 max-w-24 bg-gradient-to-l from-transparent to-border-light dark:to-border-dark" />
          </div>

          <div className="mt-8 flex justify-center">
            <div className="w-16 h-0.5 bg-accent-light dark:bg-accent-dark" />
          </div>
        </header>

        {/* Aggregate stats */}
        <div className="text-center mb-12 lg:mb-16 animate-fade-in stagger-1 animate-hidden">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-subtle-light/70 dark:text-subtle-dark/70">
            <span>{data.metadata.daysWithData}/7 {t.weekly.daysWithData}</span>
            <span className="text-border-light dark:text-border-dark">|</span>
            <span>{data.topHeadlines.length} {t.weekly.topHeadlines.toLowerCase()}</span>
            <span className="text-border-light dark:text-border-dark">|</span>
            <span>{data.metadata.totalArticlesProcessed.toLocaleString()} articles</span>
          </div>

          {/* Region coverage pills */}
          {Object.keys(data.metadata.regionCounts).length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
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

        {/* Weekly Summary */}
        <section className="mb-20 lg:mb-28 animate-fade-in-up stagger-2 animate-hidden">
          <div className="flex items-center gap-4 mb-8">
            <span className="section-label">{t.weekly.subtitle}</span>
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

        {/* Persistent Stories */}
        {data.persistentStories.length > 0 && (
          <section className="mb-16 lg:mb-20 animate-fade-in-up stagger-3 animate-hidden">
            <div className="flex items-center gap-4 mb-8">
              <span className="section-label">{t.weekly.persistentStories}</span>
              <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
            </div>

            <div className="space-y-4">
              {data.persistentStories.map((story, idx) => (
                <div
                  key={idx}
                  className="group flex items-start gap-4 p-4 lg:p-5 bg-panel-light dark:bg-panel-dark border border-border-light/60 dark:border-border-dark/60 border-l-4 border-l-accent-light dark:border-l-accent-dark animate-fade-in animate-hidden"
                  style={{ animationDelay: `${idx * 0.06}s` }}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent-light/10 dark:bg-accent-dark/10 text-accent-light dark:text-accent-dark text-xs font-bold">
                      {idx + 1}
                    </span>
                  </div>
                  <p className="font-serif text-base lg:text-lg text-text-light dark:text-text-dark leading-snug">
                    {story}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Headlines by Date */}
        <section className="mb-16 lg:mb-20 animate-fade-in-up stagger-4 animate-hidden">
          <div className="flex items-center gap-4 mb-8">
            <span className="section-label">{t.weekly.topHeadlines}</span>
            <div className="flex-1 h-px bg-border-light/50 dark:bg-border-dark/50" />
          </div>

          <div className="space-y-10">
            {headlinesByDate.map(([date, headlines], dayIdx) => (
              <div key={date} className="animate-fade-in animate-hidden" style={{ animationDelay: `${dayIdx * 0.08}s` }}>
                <div className="flex items-center gap-3 mb-4">
                  <time className="text-sm font-medium text-accent2-light dark:text-accent2-dark uppercase tracking-wide">
                    {formatDate(date, currentLanguage.code)}
                  </time>
                  <div className="flex-1 h-px bg-border-light/30 dark:bg-border-dark/30" />
                </div>

                <div className="space-y-3 pl-4 border-l border-border-light/40 dark:border-border-dark/40">
                  {headlines.map((h, hIdx) => {
                    const CategoryIcon = h.category ? categoryIcons[h.category] : null;
                    return (
                      <div key={hIdx} className="flex items-start gap-3">
                        {CategoryIcon && (
                          <CategoryIcon className="w-4 h-4 text-subtle-light dark:text-subtle-dark flex-shrink-0 mt-1" strokeWidth={1.5} />
                        )}
                        <div className="min-w-0">
                          <p className="font-serif text-base text-text-light dark:text-text-dark leading-snug">
                            {h.title}
                          </p>
                          {h.region && (
                            <span className="text-xs text-subtle-light/60 dark:text-subtle-dark/60 uppercase tracking-wide">
                              {t.regions?.[h.region] || h.region}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Back to today */}
        <div className="editorial-rule mb-8" />
        <div className="text-center py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-accent2-light dark:text-accent2-dark hover:text-accent-light dark:hover:text-accent-dark font-medium text-sm transition-all duration-300 group"
          >
            <ArrowLeftIcon className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span>{t.weekly.backToToday}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
