import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import zhCN from './zh-CN';

export type AppLocale = 'en-US' | 'zh-CN';

const storageKey = 'surprising-wallet-locale';

function initialLocale(): AppLocale {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === 'en-US' || stored === 'zh-CN') return stored;
  return window.navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

let activeLocale: AppLocale = 'en-US';

export function getIntlLocale() {
  return activeLocale;
}

function interpolate(message: string, values?: Record<string, string | number>) {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    values[key] === undefined ? match : String(values[key]));
}

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (message: string, values?: Record<string, string | number>) => string;
};

const defaultContext: I18nContextValue = {
  locale: 'en-US',
  setLocale: () => undefined,
  toggleLocale: () => undefined,
  t: interpolate,
};

const I18nContext = createContext<I18nContextValue>(defaultContext);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);
  activeLocale = locale;
  document.documentElement.lang = locale;

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: AppLocale) => {
      window.localStorage.setItem(storageKey, nextLocale);
      setLocaleState(nextLocale);
    };
    return {
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US'),
      t: (message, values) => interpolate(locale === 'zh-CN' ? (zhCN[message] ?? message) : message, values),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
