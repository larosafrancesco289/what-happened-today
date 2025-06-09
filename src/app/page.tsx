'use client';

import { useEffect, useState } from 'react';
import { fetchDailySummary, getDateString } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import NewsSummary from '@/components/NewsSummary';
import DateNavigation from '@/components/DateNavigation';
import AppHeader from '@/components/AppHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { DailyNews } from '@/types/news';

export default function HomePage() {
  const { currentLanguage } = useLanguage();
  const [data, setData] = useState<DailyNews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const today = getDateString();
  const t = getTranslations(currentLanguage.code);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const dailyNews = await fetchDailySummary(today, currentLanguage.code);
        setData(dailyNews);
      } catch (err) {
        setError(t.common.error);
        console.error('Error fetching daily news:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [today, currentLanguage.code, t.common.error]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-600 dark:text-slate-300">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">
            {t.summary.title}
          </h1>
          <p className="text-xl text-red-600 dark:text-red-400 mb-8">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t.common.retry}
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">
            {t.summary.noSummaryTitle}
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            {t.summary.noSummaryMessage}
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            {t.summary.noSummaryDescription}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppHeader />
      <NewsSummary data={data} />
      <DateNavigation currentDate={today} />
    </div>
  );
}
