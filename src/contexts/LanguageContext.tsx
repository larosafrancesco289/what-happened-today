'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
    let saved: string | null = null;
    try { saved = localStorage.getItem('preferred-language'); } catch { /* SSR */ }

    const savedLang = saved ? getLanguageFromCode(saved) : null;
    if (savedLang) {
      setCurrentLanguage(savedLang);
      return;
    }

    const detected = getLanguageFromCode(detectBrowserLanguage());
    if (detected) {
      setCurrentLanguage(detected);
    }
  }, []);

  const setLanguage = (languageCode: string) => {
    const language = getLanguageFromCode(languageCode);
    if (language) {
      setCurrentLanguage(language);
      try { localStorage.setItem('preferred-language', languageCode); } catch { /* ignore */ }
    }
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
} 