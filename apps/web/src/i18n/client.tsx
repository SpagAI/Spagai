"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, DEFAULT_LOCALE, type Locale, type TranslateFn } from ".";

const I18nContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useT(): TranslateFn {
  const locale = useContext(I18nContext);
  return useMemo(() => createTranslator(locale), [locale]);
}
