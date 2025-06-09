'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { detectBrowserLanguage, getLanguageFromCode, type Language } from '@/lib/languages';

interface LanguageContextType {
  currentLanguage: Language;
  setLanguage: (languageCode: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(() => {
    // Default to English, will be updated in useEffect
    return getLanguageFromCode('en')!;
  });

  useEffect(() => {
    // Check for saved language preference first
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && getLanguageFromCode(savedLanguage)) {
      setCurrentLanguage(getLanguageFromCode(savedLanguage)!);
      return;
    }

    // Fall back to browser language detection
    const detectedLanguage = detectBrowserLanguage();
    const language = getLanguageFromCode(detectedLanguage);
    if (language) {
      setCurrentLanguage(language);
    }
  }, []);

  const setLanguage = (languageCode: string) => {
    const language = getLanguageFromCode(languageCode);
    if (language) {
      setCurrentLanguage(language);
      localStorage.setItem('preferred-language', languageCode);
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
} 