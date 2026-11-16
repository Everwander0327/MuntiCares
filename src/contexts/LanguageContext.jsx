import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  formatLocalizedDate,
  formatLocalizedTime,
  getStoredLanguage,
  normalizeLanguage,
  translate,
  translateRole,
  translateServiceName,
  translateStatus,
} from '@/i18n';

const FALLBACK_CONTEXT = {
  language: DEFAULT_LANGUAGE,
  isTagalog: false,
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key, paramsOrFallback, maybeParams) =>
    translate(DEFAULT_LANGUAGE, key, paramsOrFallback, maybeParams),
  formatDate: (dateInput, options) => formatLocalizedDate(dateInput, DEFAULT_LANGUAGE, options),
  formatTime: (dateInput, options) => formatLocalizedTime(dateInput, DEFAULT_LANGUAGE, options),
  translateService: (name) => translateServiceName(name, DEFAULT_LANGUAGE),
  translateStatus: (status) => translateStatus(status, DEFAULT_LANGUAGE),
  translateRole: (role) => translateRole(role, DEFAULT_LANGUAGE),
};

const LanguageContext = createContext(FALLBACK_CONTEXT);

export const LanguageProvider = ({ children, initialLanguage }) => {
  const [language, setLanguageState] = useState(() =>
    initialLanguage ? normalizeLanguage(initialLanguage) : getStoredLanguage()
  );

  const setLanguage = useCallback((nextLang) => {
    const normalized = normalizeLanguage(nextLang);
    setLanguageState(normalized);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      }
    } catch {
      // ignore storage failure
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => {
      const next = prev === 'tl' ? 'en' : 'tl';
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
        }
      } catch {
        // ignore storage failure
      }
      return next;
    });
  }, []);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
      }
    } catch {
      // ignore
    }
  }, [language]);

  const value = useMemo(() => {
    const t = (key, paramsOrFallback, maybeParams) =>
      translate(language, key, paramsOrFallback, maybeParams);
    const formatDate = (dateInput, options) => formatLocalizedDate(dateInput, language, options);
    const formatTime = (dateInput, options) => formatLocalizedTime(dateInput, language, options);
    const translateService = (name) => translateServiceName(name, language);
    const translateStatusLabel = (status) => translateStatus(status, language);
    const translateRoleLabel = (role) => translateRole(role, language);

    return {
      language,
      isTagalog: language === 'tl',
      setLanguage,
      toggleLanguage,
      t,
      formatDate,
      formatTime,
      translateService,
      translateStatus: translateStatusLabel,
      translateRole: translateRoleLabel,
    };
  }, [language, setLanguage, toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext) || FALLBACK_CONTEXT;
