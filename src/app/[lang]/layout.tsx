import { notFound } from 'next/navigation';
import { LANGS, isLang } from '@/languages';

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGS.map(lang => ({ lang }));
}

export default async function LangLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return <div lang={lang}>{children}</div>;
}
