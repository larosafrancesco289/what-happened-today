import Link from 'next/link';
import { listDates, readEdition, type Edition, type Story } from '@/editions';
import { LANGS, STRINGS, formatDate, type Lang } from '@/languages';
import StaleNotice from './StaleNotice';

// Display names for the models the pipeline uses (see src/pipeline/write.ts).
const MODEL_NAMES: Record<string, string> = {
  'openai/gpt-6-luna': 'GPT-6 Luna',
  'openai/gpt-5.6-luna': 'GPT-5.6 Luna',
  'deepseek/deepseek-v4-flash-0731': 'DeepSeek V4 Flash',
};

function modelName(edition: Edition): string | undefined {
  const model = edition.metadata?.model;
  return typeof model === 'string' ? MODEL_NAMES[model] ?? model : undefined;
}

function Sources({ story }: { story: Story }) {
  const others = story.coverage ?? (story.sources ?? [])
    .filter(source => source !== story.source)
    .map(source => ({ source, link: '' }));

  return (
    <div className="sources">
      <span><a href={story.link}>{story.source}</a></span>
      {others.map(({ source, link }) => (
        <span key={source}>{link ? <a href={link}>{source}</a> : source}</span>
      ))}
    </div>
  );
}

export function Masthead({ lang, date }: { lang: Lang; date?: string }) {
  return (
    <header className="masthead">
      <Link href={`/${lang}`} className="wordmark">{STRINGS[lang].siteName}</Link>
      <nav className="langs">
        {LANGS.map(l => {
          const href = date && listDates(l).includes(date) ? `/${l}/${date}` : `/${l}`;
          return (
            <Link key={l} href={href} hrefLang={l} aria-current={l === lang ? 'true' : undefined}>
              {l.toUpperCase()}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export default function EditionView({ lang, date, isLatest }: { lang: Lang; date: string; isLatest?: boolean }) {
  const t = STRINGS[lang];
  const edition = readEdition(lang, date);
  const dates = listDates(lang);
  const index = dates.indexOf(date);
  const prev = dates[index - 1];
  const next = dates[index + 1];
  const shortDate = (d: string) => formatDate(d, lang, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <main className="page">
      <Masthead lang={lang} date={date} />

      <div className="dateline">
        <span className="weekday">{formatDate(date, lang, { weekday: 'long' })}</span>
        <h1 className="date">{formatDate(date, lang, { day: 'numeric', month: 'long', year: 'numeric' })}</h1>
      </div>

      {isLatest && <StaleNotice date={date} message={t.staleNotice(formatDate(date, lang, { day: 'numeric', month: 'long' }))} />}

      <section className="briefing">
        {edition.summary.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph.trim()}</p>)}
      </section>

      <h2 className="label">{t.stories}</h2>
      <ol className="stories">
        {edition.headlines.map((story, i) => (
          <li key={story.link} className="story">
            <span className="num">{i + 1}</span>
            <div>
              <h3><a href={story.link}>{story.title}</a></h3>
              <p>{story.summary}</p>
              <Sources story={story} />
            </div>
          </li>
        ))}
      </ol>

      <nav className="pager">
        <span>{prev && <Link href={`/${lang}/${prev}`}>← {shortDate(prev)}</Link>}</span>
        <Link href={`/${lang}/archive`}>{t.archive}</Link>
        <span>{next && <Link href={`/${lang}/${next}`}>{shortDate(next)} →</Link>}</span>
      </nav>

      <p className="about">{t.about(modelName(edition))}</p>
    </main>
  );
}
