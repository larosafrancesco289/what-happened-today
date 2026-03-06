'use client';

import { useEffect, useState } from 'react';
import type { DailyNews } from '@/types/news';
import { fetchDailySummary, getCurrentEditionDateString, getNextDate } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';

interface UseDailyNewsOptions {
  checkNextDate?: boolean;
}

interface UseDailyNewsResult {
  data: DailyNews | null;
  error: string | null;
  hasNextDate: boolean;
  loading: boolean;
}

export function useDailyNews(date: string | null, options: UseDailyNewsOptions = {}): UseDailyNewsResult {
  const { checkNextDate = false } = options;
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const [data, setData] = useState<DailyNews | null>(null);
  const [loading, setLoading] = useState(Boolean(date));
  const [error, setError] = useState<string | null>(null);
  const [hasNextDate, setHasNextDate] = useState(false);

  useEffect(() => {
    if (!date) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const requestedDate = date;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const dailyNews = await fetchDailySummary(requestedDate, currentLanguage.code);
        if (!cancelled) {
          setData(dailyNews);
        }
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(t.common.error);
        }
        console.error('Error fetching daily news:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [date, currentLanguage.code, t.common.error]);

  useEffect(() => {
    if (!checkNextDate || !date) {
      setHasNextDate(false);
      return;
    }

    const requestedDate = date;
    const nextDateString = getNextDate(requestedDate);
    if (nextDateString > getCurrentEditionDateString()) {
      setHasNextDate(false);
      return;
    }

    let cancelled = false;

    fetchDailySummary(nextDateString, currentLanguage.code)
      .then(result => {
        if (!cancelled) {
          setHasNextDate(Boolean(result));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasNextDate(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkNextDate, date, currentLanguage.code]);

  return { data, error, hasNextDate, loading };
}
