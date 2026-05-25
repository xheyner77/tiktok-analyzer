'use client';

import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  phraseTranslations,
  reversePhraseTranslations,
  sortedPhraseTranslations,
  sortedReversePhraseTranslations,
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

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'SVG', 'PATH']);

function isLanguage(value: string | null): value is Language {
  return value === 'fr' || value === 'en';
}

function translatePhrase(value: string, language: Language) {
  const exact = language === 'en' ? phraseTranslations[value] : reversePhraseTranslations[value];
  if (exact) return exact;

  let translated = value;
  const entries = language === 'en' ? sortedPhraseTranslations : sortedReversePhraseTranslations;
  for (const [source, target] of entries) {
    if (translated.includes(source)) {
      translated = translated.split(source).join(target);
    }
  }
  return translated;
}

function translateTextContent(value: string, language: Language) {
  const trimmed = value.trim();
  if (!trimmed) return value;

  const translated = translatePhrase(trimmed, language);
  if (translated === trimmed) return value;

  const leading = value.match(/^\s*/)?.[0] ?? '';
  const trailing = value.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[data-i18n-ignore="true"]')) return true;
  return false;
}

function translateDom(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!shouldSkipNode(node)) textNodes.push(node);
  }

  for (const node of textNodes) {
    node.nodeValue = translateTextContent(node.nodeValue ?? '', language);
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll<HTMLElement>('[placeholder], [aria-label], [title]'))] : Array.from(root.querySelectorAll<HTMLElement>('[placeholder], [aria-label], [title]'));
  for (const element of elements) {
    if (element.closest('[data-i18n-ignore="true"]')) continue;
    for (const attr of ['placeholder', 'aria-label', 'title']) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, translatePhrase(value, language));
    }
  }
}

function getTranslation(key: TranslationKey, language: Language) {
  const [namespace, item] = key.split('.') as [keyof typeof translations.fr, string];
  const bundle = translations[language][namespace] as Record<string, string>;
  const value = bundle[item];
  if (!value) {
    const missing = `[missing translation: ${key}]`;
    if (process.env.NODE_ENV !== 'production') {
      console.error(missing);
    }
    return missing;
  }
  return value;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const observerRef = useRef<MutationObserver | null>(null);
  const languageRef = useRef<Language>(DEFAULT_LANGUAGE);

  const applyLanguage = useCallback((nextLanguage: Language) => {
    languageRef.current = nextLanguage;
    if (typeof document === 'undefined') return;
    document.documentElement.lang = nextLanguage;
    translateDom(document.body, nextLanguage);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const initialLanguage = isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
    setLanguageState(initialLanguage);
    applyLanguage(initialLanguage);
  }, [applyLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    observerRef.current?.disconnect();
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node.nodeType === Node.TEXT_NODE && !shouldSkipNode(node)) {
            node.nodeValue = translateTextContent(node.nodeValue ?? '', languageRef.current);
          }
          if (node.nodeType === Node.ELEMENT_NODE) {
            translateDom(node as Element, languageRef.current);
          }
        }
      }
    });
    observerRef.current.observe(document.body, { childList: true, subtree: true });
    return () => observerRef.current?.disconnect();
  }, []);

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      setLanguageState(nextLanguage);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      }
      applyLanguage(nextLanguage);
    },
    [applyLanguage]
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key) => getTranslation(key, language),
    }),
    [language, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
