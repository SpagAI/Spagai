/**
 * Tiny translation helper. English is the source; other languages fall back to English
 * for any missing text. To add Pidgin, Yoruba, Hausa or Igbo, fill in the matching JSON file.
 */
import en from "./messages/en.json";
import ha from "./messages/ha.json";
import ig from "./messages/ig.json";
import pcm from "./messages/pcm.json";
import yo from "./messages/yo.json";

export type Locale = "en" | "pcm" | "yo" | "ha" | "ig";
export const LOCALES: { code: Locale; name: string; ready: boolean }[] = [
  { code: "en", name: "English", ready: true },
  { code: "pcm", name: "Pidgin", ready: false },
  { code: "yo", name: "Yorùbá", ready: false },
  { code: "ha", name: "Hausa", ready: false },
  { code: "ig", name: "Igbo", ready: false },
];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "spag_locale";

type Messages = { [key: string]: string | Messages };
const ALL: Record<Locale, Messages> = { en, pcm, yo, ha, ig };

function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/** Returns t(key) for a locale: locale text, else English, else the key itself. */
export function createTranslator(locale: Locale): TranslateFn {
  return (key, vars) => {
    const text = lookup(ALL[locale], key) ?? lookup(ALL.en, key) ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m)) : text;
  };
}
