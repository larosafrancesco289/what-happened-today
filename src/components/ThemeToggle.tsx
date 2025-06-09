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
      <div className="h-10 w-10 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/50 dark:bg-gray-800/80 dark:border-gray-700/50 animate-pulse" />
    );
  }

  return <ThemeToggleClient />;
}

function ThemeToggleClient() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200/50 hover:border-gray-300/50 hover:bg-white/90 transition-all duration-300 ease-out hover:scale-105 active:scale-95 dark:bg-gray-800/80 dark:border-gray-700/50 dark:hover:border-gray-600/50 dark:hover:bg-gray-800/90"
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
          className={`absolute inset-0 h-5 w-5 text-blue-500 transition-all duration-300 ease-out ${
            theme === 'light' 
              ? 'opacity-0 scale-0 -rotate-90' 
              : 'opacity-100 scale-100 rotate-0'
          }`}
        />
      </div>
      
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400/20 to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 dark:from-blue-400/20 dark:to-indigo-400/20" />
    </button>
  );
} 