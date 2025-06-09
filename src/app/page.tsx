import { getDailySummary, getDateString } from '@/lib/utils';
import NewsSummary from '@/components/NewsSummary';
import DateNavigation from '@/components/DateNavigation';
import AppHeader from '@/components/AppHeader';

export default async function HomePage() {
  const today = getDateString();
  const data = await getDailySummary(today);

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <AppHeader />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold text-gradient mb-6">
            What Happened Today
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            No summary available for today yet.
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            The daily summary will be generated automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppHeader />
      <NewsSummary data={data} />
      <DateNavigation currentDate={today} />
    </div>
  );
}
