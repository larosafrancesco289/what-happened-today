"use client";

import { useTheme } from './ThemeProvider';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-10 border border-border-light/60 dark:border-border-dark/60 animate-pulse" />
    );
  }

  return <ThemeToggleClient />;
}

function ThemeToggleClient() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="focus-outline group relative inline-flex h-10 w-10 items-center justify-center border border-border-light/60 dark:border-border-dark/60 hover:border-text-light dark:hover:border-text-dark transition-all duration-300 hover:bg-muted-light/50 dark:hover:bg-muted-dark/50"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative">
        <SunIcon
          className={`h-4 w-4 text-subtle-light dark:text-subtle-dark group-hover:text-accent-light dark:group-hover:text-accent-dark transition-all duration-300 ${
            theme === 'dark'
              ? 'opacity-0 scale-0 rotate-90'
              : 'opacity-100 scale-100 rotate-0'
          }`}
          strokeWidth={1.5}
        />

        <MoonIcon
          className={`absolute inset-0 h-4 w-4 text-subtle-light dark:text-subtle-dark group-hover:text-accent-light dark:group-hover:text-accent-dark transition-all duration-300 ${
            theme === 'light'
              ? 'opacity-0 scale-0 -rotate-90'
              : 'opacity-100 scale-100 rotate-0'
          }`}
          strokeWidth={1.5}
        />
      </div>
    </button>
  );
}
