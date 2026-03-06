'use client';

import type { DailyNews } from '@/types/news';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatDate } from '@/lib/client-utils';
import { getTranslations } from '@/lib/i18n';
import AppHeader from '@/components/AppHeader';
import DateNavigation from '@/components/DateNavigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import NewsSummary from '@/components/NewsSummary';

interface DailyNewsPageContentProps {
  currentDate: string;
  data: DailyNews | null;
  error: string | null;
  hasNextDate?: boolean;
  loading: boolean;
  showNavigationOnError?: boolean;
  useTodayFallbackCopy?: boolean;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <AppHeader />
      {children}
    </div>
  );
}

function CenteredMessage({
  children,
  showNavigation = false,
  currentDate,
  hasNextDate = false,
}: {
  children: React.ReactNode;
  showNavigation?: boolean;
  currentDate?: string;
  hasNextDate?: boolean;
}) {
  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {children}
      </div>
      {showNavigation && currentDate && (
        <DateNavigation currentDate={currentDate} hasNextDate={hasNextDate} />
      )}
    </PageShell>
  );
}

export default function DailyNewsPageContent({
  currentDate,
  data,
  error,
  hasNextDate = false,
  loading,
  showNavigationOnError = true,
  useTodayFallbackCopy = false,
}: DailyNewsPageContentProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <LoadingSpinner />
          <p className="mt-4 text-subtle-light dark:text-subtle-dark">{t.common.loading}</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <CenteredMessage
        currentDate={currentDate}
        hasNextDate={hasNextDate}
        showNavigation={showNavigationOnError}
      >
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
      </CenteredMessage>
    );
  }

  if (!data) {
    const formattedDate = formatDate(currentDate, currentLanguage.code);
    const message = useTodayFallbackCopy
      ? t.summary.noSummaryMessage
      : t.summary.noSummaryMessageForDate.replace('{date}', formattedDate);
    const description = useTodayFallbackCopy
      ? t.summary.noSummaryDescription
      : t.summary.noSummaryDescriptionForDate;

    return (
      <CenteredMessage currentDate={currentDate} hasNextDate={hasNextDate} showNavigation>
        <h1 className="text-4xl font-bold text-gradient mb-6">
          {t.summary.noSummaryTitle}
        </h1>
        <p className="text-xl text-subtle-light dark:text-subtle-dark mb-8">
          {message}
        </p>
        <p className="text-subtle-light dark:text-subtle-dark">
          {description}
        </p>
      </CenteredMessage>
    );
  }

  if (data.unavailable) {
    return (
      <CenteredMessage currentDate={currentDate} hasNextDate={hasNextDate} showNavigation>
        <h1 className="text-4xl font-bold text-gradient mb-6">
          {t.common.unavailableTitle}
        </h1>
        <p className="text-xl text-subtle-light dark:text-subtle-dark mb-8">
          {t.common.unavailableMessage}
        </p>
      </CenteredMessage>
    );
  }

  return (
    <PageShell>
      <NewsSummary data={data} />
      <DateNavigation currentDate={currentDate} hasNextDate={hasNextDate} />
    </PageShell>
  );
}
