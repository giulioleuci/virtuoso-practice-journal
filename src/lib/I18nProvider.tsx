import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./db";
import { I18nContext, translate, type TranslationVars } from "./i18n";

export function I18nProvider({ children, initial = "en" }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLang] = useState<Lang>(initial);

  useEffect(() => {
    setLang(initial);
  }, [initial]);

  // Stable per `lang` so consumers can list `t` in effect/memo deps without
  // re-running on every render.
  const t = useCallback(
    (key: string, vars?: TranslationVars) => translate(lang, key, vars),
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}
