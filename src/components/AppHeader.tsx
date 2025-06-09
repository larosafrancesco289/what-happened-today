"use client";

import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';

export default function AppHeader() {
  return (
    <header className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
      <div className="flex justify-end items-center gap-2">
        <LanguageSelector />
        <ThemeToggle />
      </div>
    </header>
  );
} 