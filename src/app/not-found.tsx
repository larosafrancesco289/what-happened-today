import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/50 dark:from-gray-900 dark:via-gray-800/50 dark:to-gray-900">
      <AppHeader />
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="max-w-md mx-auto text-center px-4">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Date Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            The date you're looking for doesn't have a summary available yet.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-2xl hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 transition-all duration-300 ease-out font-semibold hover:scale-105 hover:shadow-lg hover:shadow-blue-200/50 dark:hover:shadow-blue-900/25"
          >
            Go to Today
          </Link>
        </div>
      </div>
    </div>
  );
} 