import { getDailySummary, getDateString } from '@/lib/utils';
import NewsSummary from '@/components/NewsSummary';
import DateNavigation from '@/components/DateNavigation';
import AppHeader from '@/components/AppHeader';
import { notFound } from 'next/navigation';

export default async function HomePage() {
  const today = getDateString();
  const data = await getDailySummary(today);

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          What Happened Today
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          No summary available for today yet.
        </p>
        <p className="text-gray-500">
          The daily summary will be generated automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50 dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900">
      <AppHeader />
      <NewsSummary data={data} />
      <DateNavigation currentDate={today} />
    </div>
  );
}
