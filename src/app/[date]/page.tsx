'use client';

import { useEffect, useState } from 'react';
import { fetchDailySummary, formatDate, getDateString } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';
import NewsSummary from '@/components/NewsSummary';
import DateNavigation from '@/components/DateNavigation';
import AppHeader from '@/components/AppHeader';
import LoadingSpinner from '@/components/LoadingSpinner';
import type { DailyNews } from '@/types/news';
import { useParams } from 'next/navigation';

export default function DatePage() {
  const { currentLanguage } = useLanguage();
  const [data, setData] = useState<DailyNews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<string>('');
  const [hasNextDate, setHasNextDate] = useState<boolean>(false);
  
  const t = getTranslations(currentLanguage.code);
  // Avoid relying on generic types for useParams to maximize compatibility
  const params = useParams();

  useEffect(() => {
    const value = params?.["date"];
    const dateParam = Array.isArray(value) ? value[0] : value;
    if (!dateParam) return;
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateParam)) {
      setError(t.common.error);
      setLoading(false);
      return;
    }
    setDate(dateParam);
  }, [params, t.common.error]);

  useEffect(() => {
    if (!date) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const dailyNews = await fetchDailySummary(date, currentLanguage.code);
        setData(dailyNews);
      } catch (err) {
        setError(t.common.error);
        console.error('Error fetching daily news:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [date, currentLanguage.code, t.common.error]);

  // Determine if next date exists by probing the API
  useEffect(() => {
    if (!date) return;
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const nextDateString = getDateString(next);
    const today = getDateString();
    if (nextDateString > today) {
      setHasNextDate(false);
      return;
    }
    let cancelled = false;
    fetchDailySummary(nextDateString, currentLanguage.code)
      .then(res => {
        if (!cancelled) setHasNextDate(!!res);
      })
      .catch(() => {
        if (!cancelled) setHasNextDate(false);
      });
    return () => { cancelled = true; };
  }, [date, currentLanguage.code]);

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
          <h1 className="text-4xl font-bold text-gradient mb-6">
            {t.summary.title}
          </h1>
          <p className="text-xl text-accent2-light dark:text-accent2-dark mb-8">
            {error}
          </p>
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
    const formattedDate = formatDate(date, currentLanguage.code);
    const noSummaryMessage = currentLanguage.code === 'it'
      ? `Nessun riassunto disponibile per ${formattedDate}.`
      : currentLanguage.code === 'fr'
        ? `Aucun resume disponible pour le ${formattedDate}.`
        : `No summary available for ${formattedDate}.`;
    const noSummaryDescription = currentLanguage.code === 'it'
      ? 'Questa data potrebbe non essere stata ancora elaborata o potrebbe non esistere.'
      : currentLanguage.code === 'fr'
        ? "Cette date n'a peut-etre pas encore ete traitee ou n'existe pas."
        : 'This date may not have been processed yet or may not exist.';

    return (
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">
            {t.summary.noSummaryTitle}
          </h1>
          <p className="text-xl text-subtle-light dark:text-subtle-dark mb-8">
            {noSummaryMessage}
          </p>
          <p className="text-subtle-light dark:text-subtle-dark">
            {noSummaryDescription}
          </p>
        </div>
      </div>
    );
  }

  // Handle unavailable state - news generation failed for this language
  if (data.unavailable) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">
            {t.common.unavailableTitle}
          </h1>
          <p className="text-xl text-subtle-light dark:text-subtle-dark mb-8">
            {t.common.unavailableMessage}
          </p>
        </div>
        <DateNavigation currentDate={date} hasNextDate={hasNextDate} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <AppHeader />
      <NewsSummary data={data} />
      <DateNavigation currentDate={date} hasNextDate={hasNextDate} />
    </div>
  );
}
