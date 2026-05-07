import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./db";
import en from "./language/en.json";
import it from "./language/it.json";
import es from "./language/es.json";
import de from "./language/de.json";

type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = { en, it, es, de };

// ---------------------------------------------------------------------------
// Context & provider
// ---------------------------------------------------------------------------

export type TranslationVars = Record<string, string | number>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: TranslationVars) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function interpolate(str: string, vars: TranslationVars): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const val = vars[name];
    return val !== undefined ? String(val) : `{{${name}}}`;
  });
}

export function I18nProvider({ children, initial = "en" }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);

  useEffect(() => {
    setLangState(initial);
  }, [initial]);

  const setLang = (l: Lang) => setLangState(l);

  const t = (key: string, vars?: TranslationVars): string => {
    // Resolve plural form when count is provided
    let resolvedKey = key;
    if (vars && vars.count !== undefined && vars.count !== 1) {
      const pluralKey = `${key}_plural`;
      if (dicts[lang][pluralKey] !== undefined || dicts["en"][pluralKey] !== undefined) {
        resolvedKey = pluralKey;
      }
    }

    // Look up in current lang, fall back to English, then to key itself
    const raw = dicts[lang][resolvedKey] ?? dicts["en"][resolvedKey] ?? key;

    return vars ? interpolate(raw, vars) : raw;
  };

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export const SUPPORTED_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "EN" },
  { code: "it", label: "Italiano", flag: "IT" },
  { code: "es", label: "Español", flag: "ES" },
  { code: "de", label: "Deutsch", flag: "DE" },
];

// Expose raw dicts for test utilities only — do not use in components
export { dicts as _dicts };
