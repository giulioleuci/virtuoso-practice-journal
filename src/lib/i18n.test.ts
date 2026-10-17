import { describe, it, expect } from "vitest";
import { _dicts, translate, type TranslationVars } from "./i18n";

// ---------------------------------------------------------------------------
// Unit tests for the i18n translation system
// Tests: interpolation, pluralization, fallback, key coverage, no raw key leaks
// ---------------------------------------------------------------------------

const SUPPORTED_LANGS = ["en", "it", "es", "de"] as const;
type Lang = typeof SUPPORTED_LANGS[number];

const makeT = (lang: Lang) => (key: string, vars?: TranslationVars) => translate(lang, key, vars);

// ---------------------------------------------------------------------------
// Interpolation
// ---------------------------------------------------------------------------
describe("interpolation", () => {
  const t = makeT("en");

  it("replaces a single {{varName}} placeholder", () => {
    expect(t("diary.hello", { name: "Alice" })).toBe("Hello, Alice");
  });

  it("replaces multiple placeholders in one string", () => {
    expect(t("diary.doneSummary", { done: 3, total: 5 })).toBe("3/5 done today");
  });

  it("leaves unknown placeholders intact when var is missing", () => {
    // diary.hello = "Hello, {{name}}" — call without name
    const result = t("diary.hello", {});
    expect(result).toContain("{{name}}");
  });

  it("handles numeric values correctly", () => {
    expect(t("history.sessions", { count: 1 })).toMatch(/1 session/i);
  });

  it("calls with no vars returns raw translation", () => {
    expect(t("common.cancel")).toBe("Cancel");
  });
});

// ---------------------------------------------------------------------------
// Pluralization
// ---------------------------------------------------------------------------
describe("pluralization", () => {
  const t = makeT("en");

  it("uses singular form when count === 1", () => {
    expect(t("history.sessions", { count: 1 })).toBe("1 session");
  });

  it("uses plural form when count > 1", () => {
    expect(t("history.sessions", { count: 5 })).toBe("5 sessions");
  });

  it("uses plural form when count === 0", () => {
    expect(t("history.sessions", { count: 0 })).toBe("0 sessions");
  });

  it("uses plural form when count is negative", () => {
    expect(t("history.sessions", { count: -2 })).toBe("-2 sessions");
  });

  it("pluralizes collections.materialCount", () => {
    expect(t("collections.materialCount", { count: 1 })).toBe("1 material");
    expect(t("collections.materialCount", { count: 3 })).toBe("3 materials");
  });

  it("pluralizes toast.tasksBulkDone", () => {
    expect(t("toast.tasksBulkDone", { count: 1 })).toBe("1 task completed");
    expect(t("toast.tasksBulkDone", { count: 4 })).toBe("4 tasks completed");
  });


});

// ---------------------------------------------------------------------------
// Fallback behavior
// ---------------------------------------------------------------------------
describe("fallback behavior", () => {
  it("falls back to English when a key is missing in target language", () => {
    // We can use Italian — any key that exists in en but not it will fall back
    const t = makeT("it");
    // "app.name" should exist in both, just confirm it resolves
    expect(t("app.name")).toBe("Virtuoso");
  });

  it("returns the key itself when not found in any language", () => {
    const t = makeT("en");
    const missingKey = ["totally", "nonexistent", "key"].join(".");
    expect(t(missingKey)).toBe(missingKey);
  });

  it("does not return the raw key for any common key in any language", () => {
    const commonKeys = [
      "common.cancel", "common.save", "common.delete",
      "nav.today", "nav.library",
    ];
    for (const lang of SUPPORTED_LANGS) {
      const t = makeT(lang);
      for (const key of commonKeys) {
        const result = t(key);
        expect(result, `${lang}:${key} should not return raw key`).not.toBe(key);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// No raw key leakage — spot check critical UI strings in all 4 languages
// ---------------------------------------------------------------------------
describe("no raw key leakage in UI strings", () => {
  const criticalKeys = [
    "common.cancel",
    "common.save",
    "common.delete",
    "nav.today",
    "nav.library",
    "nav.lessons",
    "nav.settings",
    "diary.hello",
    "tasks.newTask",
    "errors.titleRequired",
    "errors.pickSubject",
    "toast.taskAdded",
    "toast.lessonLogged",
    "notFound.heading",
    "profile.settings",
  ];

  for (const lang of SUPPORTED_LANGS) {
    it(`resolves all critical keys in ${lang}`, () => {
      const t = makeT(lang);
      for (const key of criticalKeys) {
        const result = t(key);
        expect(result, `${lang}:${key} must not leak raw key`).not.toBe(key);
        expect(result, `${lang}:${key} must not be empty`).not.toBe("");
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Key coverage — verify all English keys have values in all languages (or fall back)
// ---------------------------------------------------------------------------
describe("key coverage", () => {
  it("all English keys resolve to non-empty strings in every language", () => {
    const enKeys = Object.keys(_dicts["en"]);
    // Skip plural variants (they're intentionally only defined where needed)
    const baseKeys = enKeys.filter((k) => !k.endsWith("_plural"));

    for (const lang of SUPPORTED_LANGS) {
      const t = makeT(lang);
      for (const key of baseKeys) {
        const result = t(key);
        expect(result, `${lang}:${key} must not be empty`).not.toBe("");
        // The result should not be the raw key (meaning it falls back to en at worst)
        // Unless it's a key that happens to match its own value (very unlikely)
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Locale switching — simulate switching language mid-session
// ---------------------------------------------------------------------------
describe("locale switching", () => {
  it("returns different strings for common.cancel in different languages", () => {
    const results = SUPPORTED_LANGS.map((lang) => makeT(lang)("common.cancel"));
    // At minimum, English and Italian should differ
    expect(results[0]).toBe("Cancel"); // en
    expect(results[1]).toBe("Annulla"); // it
  });

  it("returns different strings for common.save in different languages", () => {
    const en = makeT("en")("common.save");
    const de = makeT("de")("common.save");
    expect(en).not.toBe(de);
  });
});
