import type { Metadata } from 'next';
import { listDates } from '@/editions';
import { LANGS, STRINGS, formatDate, type Lang } from '@/languages';
import EditionView from '../../EditionView';

type Props = { params: Promise<{ lang: Lang; date: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.flatMap(lang => listDates(lang).map(date => ({ lang, date })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, date } = await params;
  const day = formatDate(date, lang, { day: 'numeric', month: 'long', year: 'numeric' });
  return { title: `${day} · ${STRINGS[lang].siteName}`, description: STRINGS[lang].description };
}

export default async function DatedEdition({ params }: Props) {
  const { lang, date } = await params;
  const isLatest = listDates(lang).at(-1) === date;
  return <EditionView lang={lang} date={date} isLatest={isLatest} />;
}
