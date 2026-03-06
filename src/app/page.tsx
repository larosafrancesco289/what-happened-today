'use client';

import DailyNewsPageContent from '@/components/DailyNewsPageContent';
import { getCurrentEditionDateString } from '@/lib/client-utils';
import { useDailyNews } from '@/hooks/use-daily-news';

export default function HomePage() {
  const today = getCurrentEditionDateString();
  const { data, error, loading } = useDailyNews(today);

  return (
    <DailyNewsPageContent
      currentDate={today}
      data={data}
      error={error}
      loading={loading}
      useTodayFallbackCopy
    />
  );
}
