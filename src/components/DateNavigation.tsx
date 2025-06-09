import Link from 'next/link';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getPreviousDate, getNextDate, formatDate } from '@/lib/utils';

interface DateNavigationProps {
  currentDate: string;
  hasNextDate?: boolean;
}

export default function DateNavigation({ currentDate, hasNextDate = false }: DateNavigationProps) {
  const previousDate = getPreviousDate(currentDate);
  const nextDate = getNextDate(currentDate);
  const today = new Date().toISOString().split('T')[0];
  const isToday = currentDate === today;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        {/* Previous Date */}
        <Link
          href={`/${previousDate}`}
          className="group flex items-center gap-3 px-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl hover:bg-white/90 dark:hover:bg-gray-800/90 hover:border-gray-300/50 dark:hover:border-gray-600/50 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/25 transition-all duration-300 ease-out hover:scale-105"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          <div className="text-left hidden sm:block">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Previous</div>
            <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">{formatDate(previousDate)}</div>
          </div>
          <div className="text-left sm:hidden">
            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Previous</div>
          </div>
        </Link>

        {/* Today Link */}
        {!isToday && (
          <Link
            href="/"
            className="group px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all duration-300 ease-out font-semibold hover:scale-105 hover:shadow-lg hover:shadow-blue-200/50 dark:hover:shadow-blue-900/25"
          >
            Today
          </Link>
        )}

        {/* Next Date */}
        {hasNextDate && (
          <Link
            href={`/${nextDate}`}
            className="group flex items-center gap-3 px-4 py-3 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl hover:bg-white/90 dark:hover:bg-gray-800/90 hover:border-gray-300/50 dark:hover:border-gray-600/50 hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-gray-900/25 transition-all duration-300 ease-out hover:scale-105"
          >
            <div className="text-right hidden sm:block">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Next</div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">{formatDate(nextDate)}</div>
            </div>
            <div className="text-right sm:hidden">
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">Next</div>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          </Link>
        )}

        {/* Placeholder for alignment when no next date */}
        {!hasNextDate && <div className="w-32"></div>}
      </div>
    </div>
  );
} 