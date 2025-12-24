"use client";

import ThemeToggle from './ThemeToggle';
import LanguageSelector from './LanguageSelector';

export default function AppHeader() {
  return (
    <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
      <div className="flex items-center justify-between">
        {/* Left side - decorative element */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="w-8 h-px bg-border-light dark:bg-border-dark" />
          <div className="w-1.5 h-1.5 rotate-45 bg-accent-light dark:bg-accent-dark" />
        </div>

        {/* Right side - controls */}
        <div className="flex items-center gap-3 ml-auto">
          <LanguageSelector />
          <div className="w-px h-6 bg-border-light/50 dark:bg-border-dark/50" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
