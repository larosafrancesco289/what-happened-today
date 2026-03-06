'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import DailyNewsPageContent from '@/components/DailyNewsPageContent';
import { useDailyNews } from '@/hooks/use-daily-news';
import { isValidDateString } from '@/lib/date-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';

function getDateParam(params: ReturnType<typeof useParams>): string {
  const value = params?.date;
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function DatePage() {
  const params = useParams();
  const requestedDate = getDateParam(params);
  const isValidDate = useMemo(() => isValidDateString(requestedDate), [requestedDate]);
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  const { data, error, hasNextDate, loading } = useDailyNews(isValidDate ? requestedDate : null, {
    checkNextDate: isValidDate,
  });

  return (
    <DailyNewsPageContent
      currentDate={requestedDate}
      data={data}
      error={requestedDate && !isValidDate ? t.common.invalidDate : error}
      hasNextDate={hasNextDate}
      loading={!requestedDate || (isValidDate && loading)}
      showNavigationOnError={isValidDate}
    />
  );
}
