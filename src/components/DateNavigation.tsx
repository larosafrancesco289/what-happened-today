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
          className="group flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 rounded-2xl hover:bg-white/95 dark:hover:bg-slate-800/95 hover:border-slate-300/80 dark:hover:border-slate-600/80 hover:shadow-xl hover:shadow-slate-200/20 dark:hover:shadow-slate-900/40 transition-all duration-300 ease-out hover:scale-105 active:scale-95"
        >
          <ChevronLeftIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          <div className="text-left hidden sm:block">
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{t.navigation.previousDay}</div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{formatDate(previousDate, currentLanguage.code)}</div>
          </div>
          <div className="text-left sm:hidden">
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.navigation.previousDay}</div>
          </div>
        </Link>

        {/* Today Link */}
        {!isToday && (
          <Link
            href="/"
            className="group relative px-6 lg:px-8 py-3 lg:py-4 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-500 dark:to-indigo-500 text-white rounded-2xl hover:from-blue-700 hover:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 transition-all duration-300 ease-out font-semibold hover:scale-105 active:scale-95 hover:shadow-xl hover:shadow-blue-200/30 dark:hover:shadow-blue-900/30 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative">{t.navigation.today}</span>
          </Link>
        )}

        {/* Next Date */}
        {hasNextDate && (
          <Link
            href={`/${nextDate}`}
            className="group flex items-center gap-3 px-4 lg:px-6 py-3 lg:py-4 bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 rounded-2xl hover:bg-white/95 dark:hover:bg-slate-800/95 hover:border-slate-300/80 dark:hover:border-slate-600/80 hover:shadow-xl hover:shadow-slate-200/20 dark:hover:shadow-slate-900/40 transition-all duration-300 ease-out hover:scale-105 active:scale-95"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide font-medium">{t.navigation.nextDay}</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">{formatDate(nextDate, currentLanguage.code)}</div>
            </div>
            <div className="text-right sm:hidden">
              <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{t.navigation.nextDay}</div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </Link>
        )}

        {/* Placeholder for alignment when no next date */}
        {!hasNextDate && <div className="w-24 lg:w-32"></div>}
      </div>
    </nav>
  );
} 