import type { Metadata } from "next";
import { Cormorant_Garamond, Source_Sans_3, JetBrains_Mono as JetBrainsMono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Analytics } from '@vercel/analytics/react';

// Editorial serif for headlines - elegant, high-contrast, newspaper feel
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

// Refined sans-serif for body text - clean, readable, modern
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap"
});

const jetbrains = JetBrainsMono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "What Happened Today",
  description: "A clean, AI-generated daily summary of global news — free from clickbait, emotion, and information overload.",
  keywords: "news, daily summary, global news, AI-generated, unbiased news",
  authors: [{ name: "What Happened Today" }],
  robots: "index, follow",
  openGraph: {
    title: "What Happened Today",
    description: "A clean, AI-generated daily summary of global news",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "What Happened Today",
    description: "A clean, AI-generated daily summary of global news",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#08070a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${cormorant.variable} ${sourceSans.variable} ${jetbrains.variable} antialiased bg-bg-light text-text-light dark:bg-bg-dark dark:text-text-dark`}>
        <ThemeProvider>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
