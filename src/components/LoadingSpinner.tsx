export default function LoadingSpinner() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 mb-6">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-border-light dark:border-border-dark border-t-accent-light dark:border-t-accent-dark"></div>
      </div>
      <p className="text-lg text-subtle-light dark:text-subtle-dark font-light">Loading today&apos;s summary...</p>
    </div>
  );
} 