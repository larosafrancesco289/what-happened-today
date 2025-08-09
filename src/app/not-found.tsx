import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
      <AppHeader />
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="max-w-md mx-auto text-center px-4">
          <h1 className="text-6xl font-bold text-text-light dark:text-text-dark mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-text-light dark:text-text-dark mb-4">
            Date Not Found
          </h2>
          <p className="text-subtle-light dark:text-subtle-dark mb-8">
            The date you&apos;re looking for doesn&apos;t have a summary available yet.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-accent-light text-text-light rounded-xl transition-all duration-300 ease-out font-semibold hover:scale-105 hover:shadow-card dark:hover:shadow-cardDark border border-border-light dark:border-border-dark"
          >
            Go to Today
          </Link>
        </div>
      </div>
    </div>
  );
} 