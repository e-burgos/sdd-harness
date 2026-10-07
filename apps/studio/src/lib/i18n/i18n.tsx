'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { es, type Dict } from './es';

export type Lang = 'es' | 'en';
const LANG_KEY = 'sdd-studio:lang';
const DICTS: Record<Lang, Dict> = { es, en };

export type TFunction = (key: keyof Dict, vars?: Record<string, string | number>) => string;

export function detectLang(navigatorLang: string | undefined, stored: string | null): Lang {
  if (stored === 'es' || stored === 'en') return stored;
  return navigatorLang?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

interface I18nValue {
  t: TFunction;
  lang: Lang;
  setLang(lang: Lang): void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(
    () => initial ?? detectLang(typeof navigator === 'undefined' ? undefined : navigator.language, readStored()),
  );
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // sin storage: el cambio vale para esta sesión
    }
  }, []);
  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[lang];
    const t: TFunction = (key, vars = {}) =>
      dict[key].replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
    return { t, lang, setLang };
  }, [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT must be used inside <I18nProvider>');
  return value;
}
