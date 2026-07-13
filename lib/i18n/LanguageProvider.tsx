'use client';

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LANGUAGE,
  translations,
  type Language,
  type TranslationKey,
} from './translations';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

export const LanguageContext = createContext<LanguageContextValue | null>(null);

function getTranslation(key: TranslationKey, language: Language) {
  const [namespace, item] = key.split('.') as [keyof typeof translations.fr, string];
  const bundle = translations[language][namespace] as Record<string, string>;
  const value = bundle[item];
  if (value) return value;

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[missing translation: ${key}]`);
  }
  const frenchBundle = translations.fr[namespace] as Record<string, string>;
  return frenchBundle[item] ?? key;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Le produit public reste en français. Les écrans de review qui ont besoin
  // d'une version anglaise peuvent changer ce contexte explicitement sans
  // réécrire le DOM global ni persister un état partiellement traduit.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => getTranslation(key, language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
