export default function LoadingSpinner() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 mb-6">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-400"></div>
      </div>
      <p className="text-lg text-slate-600 dark:text-slate-300 font-light">Loading today&apos;s summary...</p>
    </div>
  );
} 