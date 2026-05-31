#!/usr/bin/env node
/**
 * i18n validation script
 * Checks that all English translation keys exist in all supported languages,
 * and reports missing/extra keys.
 *
 * Usage: node scripts/validate-i18n.mjs
 * Exit code: 0 = all good, 1 = missing keys found
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const langDir = join(root, "src/lib/language");

const SUPPORTED_LANGS = ["en", "it", "es", "de"];

const langKeys = {};
for (const lang of SUPPORTED_LANGS) {
  const json = JSON.parse(readFileSync(join(langDir, `${lang}.json`), "utf-8"));
  langKeys[lang] = new Set(Object.keys(json));
}

const enKeys = langKeys["en"];
const enBase = new Set([...enKeys].filter((k) => !k.endsWith("_plural")));

let hasErrors = false;

for (const lang of SUPPORTED_LANGS) {
  if (lang === "en") continue;
  const langSet = langKeys[lang];
  const missing = [];
  const extra = [];

  for (const key of enBase) {
    if (!langSet.has(key)) {
      const hasPluralInEn = enKeys.has(`${key}_plural`);
      missing.push(key + (hasPluralInEn ? " (+ _plural)" : ""));
    }
  }

  for (const key of langSet) {
    const base = key.endsWith("_plural") ? key.slice(0, -7) : key;
    if (!enKeys.has(key) && !enKeys.has(base)) {
      extra.push(key);
    }
  }

  if (missing.length > 0) {
    hasErrors = true;
    console.error(`\n[${lang}] Missing ${missing.length} key(s):`);
    for (const k of missing) console.error(`  - ${k}`);
  }

  if (extra.length > 0) {
    console.warn(`\n[${lang}] Extra ${extra.length} key(s) not in English:`);
    for (const k of extra) console.warn(`  + ${k}`);
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log(`[${lang}] ✓ All keys present`);
  }
}

if (hasErrors) {
  console.error("\n✗ i18n validation failed — missing keys found");
  process.exit(1);
} else {
  console.log("\n✓ i18n validation passed");
  process.exit(0);
}
