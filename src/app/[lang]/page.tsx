import type { Metadata } from 'next';
import { listDates } from '@/editions';
import { STRINGS, type Lang } from '@/languages';
import EditionView from '../EditionView';

type Props = { params: Promise<{ lang: Lang }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return { title: STRINGS[lang].siteName, description: STRINGS[lang].description };
}

export default async function LatestEdition({ params }: Props) {
  const { lang } = await params;
  return <EditionView lang={lang} date={listDates(lang).at(-1)!} isLatest />;
}
