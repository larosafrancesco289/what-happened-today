import type { Metadata } from 'next';
import Link from 'next/link';
import { listDates } from '@/editions';
import { STRINGS, formatDate, type Lang } from '@/languages';
import { Masthead } from '../../EditionView';

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: `${STRINGS[lang].archive} · ${STRINGS[lang].siteName}` };
}

/** One Monday-first calendar grid per month, newest month first. */
function Month({ lang, month, dates }: { lang: Lang; month: string; dates: Set<string> }) {
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;

  return (
    <section className="month">
      <h2>{formatDate(`${month}-01`, lang, { month: 'long', year: 'numeric' })}</h2>
      <div className="calendar">
        {Array.from({ length: leadingBlanks }, (_, i) => <i key={`blank-${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          return dates.has(date)
            ? <Link key={date} href={`/${lang}/${date}`}>{i + 1}</Link>
            : <span key={date}>{i + 1}</span>;
        })}
      </div>
    </section>
  );
}

export default async function Archive({ params }: Props) {
  const { lang } = await params;
  const dates = listDates(lang);
  const published = new Set(dates);
  const months = [...new Set(dates.map(date => date.slice(0, 7)))].reverse();

  return (
    <main className="page">
      <Masthead lang={lang} />
      <div className="dateline">
        <h1 className="date">{STRINGS[lang].archive}</h1>
      </div>
      {months.map(month => <Month key={month} lang={lang} month={month} dates={published} />)}
    </main>
  );
}
