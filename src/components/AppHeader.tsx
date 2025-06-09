"use client";

import ThemeToggle from './ThemeToggle';

export default function AppHeader() {
  return (
    <header className="max-w-4xl mx-auto px-4 pt-8 pb-4">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
    </header>
  );
} 