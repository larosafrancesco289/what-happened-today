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
      <div className="h-12 w-12 rounded-2xl bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 animate-pulse" />
    );
  }

  return <ThemeToggleClient />;
}

function ThemeToggleClient() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 dark:bg-slate-800/90 glass border border-slate-200/60 dark:border-slate-700/60 hover:border-slate-300/80 dark:hover:border-slate-600/80 hover:bg-white/95 dark:hover:bg-slate-800/95 transition-all duration-300 ease-out hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-slate-200/20 dark:hover:shadow-slate-900/40"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className="relative">
        {/* Sun Icon */}
        <SunIcon 
          className={`h-5 w-5 text-amber-500 transition-all duration-300 ease-out ${
            theme === 'dark' 
              ? 'opacity-0 scale-0 rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />
        
        {/* Moon Icon */}
        <MoonIcon 
          className={`absolute inset-0 h-5 w-5 text-indigo-500 dark:text-blue-400 transition-all duration-300 ease-out ${
            theme === 'light' 
              ? 'opacity-0 scale-0 -rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />
      </div>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400/10 to-orange-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 dark:from-blue-400/10 dark:to-indigo-400/10" />
    </button>
  );
} 