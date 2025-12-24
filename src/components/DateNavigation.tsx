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
    <nav className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      {/* Top decorative rule */}
      <div className="editorial-rule mb-10" />

      <div className="flex items-center justify-between gap-4">
        {/* Previous Date */}
        <Link
          href={`/${previousDate}`}
          className="focus-outline group flex items-center gap-3 py-3 transition-all duration-300"
        >
          <div className="w-10 h-10 flex items-center justify-center border border-border-light dark:border-border-dark group-hover:border-text-light dark:group-hover:border-text-dark group-hover:bg-muted-light/50 dark:group-hover:bg-muted-dark/50 transition-all duration-300">
            <ChevronLeftIcon
              className="w-4 h-4 text-subtle-light dark:text-subtle-dark group-hover:text-text-light dark:group-hover:text-text-dark transition-colors"
              strokeWidth={1.5}
            />
          </div>
          <div className="text-left hidden sm:block">
            <div className="section-label mb-1">{t.navigation.previousDay}</div>
            <div className="font-serif text-text-light dark:text-text-dark group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors">
              {formatDate(previousDate, currentLanguage.code)}
            </div>
          </div>
        </Link>

        {/* Today Link */}
        {!isToday && (
          <Link
            href="/"
            className="group relative px-8 py-3 border-2 border-accent-light dark:border-accent-dark text-accent-light dark:text-accent-dark hover:bg-accent-light dark:hover:bg-accent-dark hover:text-white dark:hover:text-bg-dark transition-all duration-300 font-serif font-semibold tracking-wide"
          >
            {t.navigation.today}
          </Link>
        )}

        {/* Center decoration when on today */}
        {isToday && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-px bg-border-light dark:bg-border-dark" />
            <div className="w-2 h-2 rotate-45 border border-accent-light dark:border-accent-dark" />
            <div className="w-8 h-px bg-border-light dark:bg-border-dark" />
          </div>
        )}

        {/* Next Date */}
        {hasNextDate ? (
          <Link
            href={`/${nextDate}`}
            className="focus-outline group flex items-center gap-3 py-3 transition-all duration-300"
          >
            <div className="text-right hidden sm:block">
              <div className="section-label mb-1">{t.navigation.nextDay}</div>
              <div className="font-serif text-text-light dark:text-text-dark group-hover:text-accent-light dark:group-hover:text-accent-dark transition-colors">
                {formatDate(nextDate, currentLanguage.code)}
              </div>
            </div>
            <div className="w-10 h-10 flex items-center justify-center border border-border-light dark:border-border-dark group-hover:border-text-light dark:group-hover:border-text-dark group-hover:bg-muted-light/50 dark:group-hover:bg-muted-dark/50 transition-all duration-300">
              <ChevronRightIcon
                className="w-4 h-4 text-subtle-light dark:text-subtle-dark group-hover:text-text-light dark:group-hover:text-text-dark transition-colors"
                strokeWidth={1.5}
              />
            </div>
          </Link>
        ) : (
          <div className="w-28 lg:w-40" />
        )}
      </div>

      {/* Bottom decorative element */}
      <div className="mt-10 flex justify-center">
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 bg-border-light dark:bg-border-dark rotate-45" />
          <div className="w-1 h-1 bg-accent-light dark:bg-accent-dark rotate-45" />
          <div className="w-1 h-1 bg-border-light dark:bg-border-dark rotate-45" />
        </div>
      </div>
    </nav>
  );
}
