'use client';

import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getPreviousDate, getNextDate, formatDate } from '@/lib/client-utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslations } from '@/lib/i18n';

interface DateNavigationProps {
  currentDate: string;
  hasNextDate?: boolean;
}

export default function DateNavigation({ currentDate, hasNextDate = false }: DateNavigationProps) {
  const { currentLanguage } = useLanguage();
  const t = getTranslations(currentLanguage.code);
  
  const previousDate = getPreviousDate(currentDate);
  const nextDate = getNextDate(currentDate);
  const today = new Date().toISOString().split('T')[0];
  const isToday = currentDate === today;

  return (
    <nav className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="flex items-center justify-between gap-4">
        {/* Previous Date */}
        <Link
          href={`/${previousDate}`}
          className="focus-outline group flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl hover:bg-panel-light/95 dark:hover:bg-panel-dark/95 hover:border-border-light dark:hover:border-border-dark hover:shadow-card dark:hover:shadow-cardDark transition-all duration-300 ease-out hover:scale-105 active:scale-95"
        >
          <ChevronLeftIcon className="w-5 h-5 text-subtle-light dark:text-subtle-dark group-hover:text-text-light dark:group-hover:text-text-dark transition-colors" />
          <div className="text-left hidden sm:block">
            <div className="text-xs text-subtle-light dark:text-subtle-dark uppercase tracking-wide font-medium">{t.navigation.previousDay}</div>
            <div className="font-semibold text-text-light dark:text-text-dark group-hover:text-text-light dark:group-hover:text-text-dark transition-colors">{formatDate(previousDate, currentLanguage.code)}</div>
          </div>
          <div className="text-left sm:hidden">
            <div className="font-semibold text-sm text-text-light dark:text-text-dark">{t.navigation.previousDay}</div>
          </div>
        </Link>

        {/* Today Link */}
        {!isToday && (
          <Link
            href="/"
            className="group relative px-6 lg:px-8 py-3 lg:py-4 bg-accent-light dark:bg-accent-dark text-text-light dark:text-text-dark rounded-xl transition-all duration-300 ease-out font-semibold hover:scale-105 active:scale-95 shadow-card dark:shadow-cardDark border border-border-light dark:border-border-dark"
          >
            <div className="absolute inset-0 rounded-xl bg-accent2-light/10 dark:bg-accent2-dark/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative">{t.navigation.today}</span>
          </Link>
        )}

        {/* Next Date */}
        {hasNextDate && (
          <Link
            href={`/${nextDate}`}
            className="focus-outline group flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 rounded-xl hover:bg-panel-light/95 dark:hover:bg-panel-dark/95 hover:border-border-light dark:hover:border-border-dark hover:shadow-card dark:hover:shadow-cardDark transition-all duration-300 ease-out hover:scale-105 active:scale-95"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs text-subtle-light dark:text-subtle-dark uppercase tracking-wide font-medium">{t.navigation.nextDay}</div>
              <div className="font-semibold text-text-light dark:text-text-dark transition-colors">{formatDate(nextDate, currentLanguage.code)}</div>
            </div>
            <div className="text-right sm:hidden">
              <div className="font-semibold text-sm text-text-light dark:text-text-dark">{t.navigation.nextDay}</div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-subtle-light dark:text-subtle-dark group-hover:text-text-light dark:group-hover:text-text-dark transition-colors" />
          </Link>
        )}

        {/* Placeholder for alignment when no next date */}
        {!hasNextDate && <div className="w-24 lg:w-32"></div>}
      </div>
    </nav>
  );
} 