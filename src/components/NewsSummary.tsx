import { DailyNews, NewsHeadline } from '@/types/news';
import { formatDate } from '@/lib/utils';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface NewsSummaryProps {
  data: DailyNews;
}

function HeadlineCard({ headline }: { headline: NewsHeadline }) {
  return (
    <div className="group bg-white/70 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300/50 hover:bg-white/80 transition-all duration-300 ease-out hover:-translate-y-1 dark:bg-gray-800/70 dark:border-gray-700/50 dark:hover:shadow-lg dark:hover:shadow-gray-900/25 dark:hover:border-gray-600/50 dark:hover:bg-gray-800/80">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight pr-0 sm:pr-4 mb-2 sm:mb-0 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
          {headline.title}
        </h3>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50">
          {headline.source}
        </span>
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-5 leading-relaxed text-sm">
        {headline.summary}
      </p>
      <a
        href={headline.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm transition-colors group/link"
      >
        Read full article
        <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-1.5 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
      </a>
    </div>
  );
}

export default function NewsSummary({ data }: NewsSummaryProps) {
  const summaryParagraphs = data.summary.split('\n\n');

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="text-center mb-12 sm:mb-16">
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
            What Happened Today
          </h1>
          <p className="text-xl sm:text-2xl text-gray-500 dark:text-gray-400 font-light">
            {formatDate(data.date)}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-16">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8 flex items-center gap-3">
          <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
          Daily Summary
        </h2>
        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-3xl p-8 sm:p-10 space-y-6">
          {summaryParagraphs.map((paragraph: string, index: number) => (
            <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg font-light">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {/* Headlines */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-8 flex items-center gap-3">
          <div className="w-8 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
          Top Headlines
        </h2>
        <div className="grid gap-6">
          {data.headlines.map((headline: NewsHeadline, index: number) => (
            <HeadlineCard key={index} headline={headline} />
          ))}
        </div>
      </div>
    </div>
  );
} 