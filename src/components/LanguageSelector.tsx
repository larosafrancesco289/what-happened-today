'use client';

import { useState } from 'react';
import { ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

export default function LanguageSelector() {
  const { currentLanguage, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="focus-outline flex items-center gap-2 px-3 py-2 text-sm font-medium text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark transition-colors rounded-xl hover:bg-muted-light dark:hover:bg-muted-dark"
        aria-label="Select language"
      >
        <GlobeAltIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLanguage.flag}</span>
        <span className="hidden md:inline">{currentLanguage.nativeName}</span>
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
          <div className="absolute right-0 mt-2 w-48 bg-panel-light dark:bg-panel-dark rounded-xl shadow-card dark:shadow-cardDark border border-border-light dark:border-border-dark z-20">
            <div className="py-1">
              {SUPPORTED_LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  onClick={() => {
                    setLanguage(language.code);
                    setIsOpen(false);
                  }}
                  className={`focus-outline w-full text-left px-4 py-2 text-sm hover:bg-muted-light dark:hover:bg-muted-dark transition-colors ${
                    currentLanguage.code === language.code 
                      ? 'bg-accent-light/10 dark:bg-accent-dark/10 text-text-light dark:text-text-dark' 
                      : 'text-subtle-light dark:text-subtle-dark'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{language.flag}</span>
                    <div>
                      <div className="font-medium text-text-light dark:text-text-dark">{language.nativeName}</div>
                      <div className="text-xs text-subtle-light dark:text-subtle-dark">{language.name}</div>
                    </div>
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