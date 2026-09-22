import type { Metadata, Viewport } from 'next';
import { Newsreader } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  axes: ['opsz'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'What Happened Today',
  description: 'The day’s most important news in five minutes, without the noise.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f3ec' },
    { media: '(prefers-color-scheme: dark)', color: '#151412' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
