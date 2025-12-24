'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

export default function LanguageSelector() {
  const { currentLanguage, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus-outline flex items-center gap-2 px-3 py-2 text-sm font-medium text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark transition-colors border border-transparent hover:border-border-light dark:hover:border-border-dark"
        aria-label="Select language"
      >
        <span className="text-base">{currentLanguage.flag}</span>
        <span className="hidden sm:inline uppercase tracking-wider text-xs font-semibold">
          {currentLanguage.code}
        </span>
        <ChevronDownIcon
          className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-52 bg-panel-light dark:bg-panel-dark border border-border-light dark:border-border-dark shadow-elevated dark:shadow-elevatedDark z-20 animate-scale-in origin-top-right">
            {/* Decorative top line */}
            <div className="h-0.5 bg-accent-light dark:bg-accent-dark" />

            <div className="py-2">
              {SUPPORTED_LANGUAGES.map((language, idx) => (
                <button
                  key={language.code}
                  onClick={() => {
                    setLanguage(language.code);
                    setIsOpen(false);
                  }}
                  className={`focus-outline w-full text-left px-4 py-3 transition-all duration-200 group ${
                    currentLanguage.code === language.code
                      ? 'bg-muted-light dark:bg-muted-dark'
                      : 'hover:bg-muted-light/50 dark:hover:bg-muted-dark/50'
                  }`}
                  style={{ animationDelay: `${idx * 0.03}s` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{language.flag}</span>
                    <div className="flex-1">
                      <div className="font-serif font-medium text-text-light dark:text-text-dark">
                        {language.nativeName}
                      </div>
                      <div className="text-xs text-subtle-light dark:text-subtle-dark tracking-wide">
                        {language.name}
                      </div>
                    </div>
                    {currentLanguage.code === language.code && (
                      <div className="w-1.5 h-1.5 bg-accent-light dark:bg-accent-dark rotate-45" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
