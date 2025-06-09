import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
