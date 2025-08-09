"use client";

import { useTheme } from './ThemeProvider';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render anything until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="h-12 w-12 rounded-xl bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 animate-pulse" />
    );
  }

  return <ThemeToggleClient />;
}

function ThemeToggleClient() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="focus-outline group relative inline-flex h-12 w-12 items-center justify-center rounded-xl bg-panel-light/90 dark:bg-panel-dark/90 glass border border-border-light/60 dark:border-border-dark/60 hover:bg-panel-light dark:hover:bg-panel-dark transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:shadow-card dark:hover:shadow-cardDark"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative">
        {/* Sun Icon */}
        <SunIcon 
          className={`h-5 w-5 text-accent-light transition-all duration-300 ease-out ${
            theme === 'dark' 
              ? 'opacity-0 scale-0 rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />
        
        {/* Moon Icon */}
        <MoonIcon 
          className={`absolute inset-0 h-5 w-5 text-accent2-light dark:text-accent2-dark transition-all duration-300 ease-out ${
            theme === 'light' 
              ? 'opacity-0 scale-0 -rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />
      </div>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-accent-light/10 dark:bg-accent-dark/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </button>
  );
} 