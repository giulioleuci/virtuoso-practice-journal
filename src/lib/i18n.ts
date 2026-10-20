import { createContext, useContext } from "react";
import type { Lang } from "./db";
import en from "./language/en.json";
import it from "./language/it.json";
import es from "./language/es.json";
import de from "./language/de.json";

type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { en, it, es, de };

export type TranslationVars = Record<string, string | number>;

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: TranslationVars) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars: TranslationVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const value = vars[name];
    return value !== undefined ? String(value) : `{{${name}}}`;
  });
}

export function translate(lang: Lang, key: string, vars?: TranslationVars): string {
  let resolvedKey = key;
  if (vars && vars.count !== undefined && vars.count !== 1) {
    const pluralKey = `${key}_plural`;
    if (dicts[lang][pluralKey] !== undefined || dicts["en"][pluralKey] !== undefined) {
      resolvedKey = pluralKey;
    }
  }
  const raw = dicts[lang][resolvedKey] ?? dicts["en"][resolvedKey] ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

/** Supported language of the browser, English otherwise. For screens outside a profile (onboarding, root errors). */
export function browserLang(): Lang {
  const code = (typeof navigator !== "undefined" ? navigator.language : "en").slice(0, 2);
  return code in dicts ? (code as Lang) : "en";
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export const SUPPORTED_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "it", label: "Italiano", flag: "IT" },
  { code: "es", label: "Español", flag: "ES" },
  { code: "de", label: "Deutsch", flag: "DE" },
];

// Exposed for i18n parity tests only — do not use in components.
export { dicts as _dicts };
