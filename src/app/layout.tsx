import type { Metadata } from "next";
import { Inter, JetBrains_Mono as JetBrainsMono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrainsMono({ subsets: ["latin"], variable: "--font-jetbrains" });

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
      <body className={`${inter.variable} ${jetbrains.variable} antialiased bg-bg-light text-text-light dark:bg-bg-dark dark:text-text-dark`}>
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
