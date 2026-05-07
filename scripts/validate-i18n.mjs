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
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Read the i18n.tsx file and extract the dicts object
const src = readFileSync(join(root, "src/lib/i18n.tsx"), "utf-8");

// Extract all translation keys by regex-parsing the TypeScript source.
// We look for lines of the form: "key.name": "...",
const KEY_RE = /^\s+"([^"]+)":\s+"([^"]*)"/gm;

const SUPPORTED_LANGS = ["en", "it", "es", "de"];

// Identify which language section a key belongs to by tracking lang markers.
// We find each `  en: {`, `  it: {`, etc. block.
const LANG_BLOCK_RE = /^\s{2}(en|it|es|de):\s*\{/gm;

const langRanges = [];
let match;
while ((match = LANG_BLOCK_RE.exec(src)) !== null) {
  langRanges.push({ lang: match[1], start: match.index });
}
// Add sentinel
langRanges.push({ lang: null, start: src.length });

// For each lang, collect keys in its range
const langKeys = {};
for (let i = 0; i < langRanges.length - 1; i++) {
  const { lang, start } = langRanges[i];
  const end = langRanges[i + 1].start;
  const chunk = src.slice(start, end);
  const keys = new Set();
  let m;
  const re = /^\s+"([^"]+)":\s+"/gm;
  while ((m = re.exec(chunk)) !== null) {
    keys.add(m[1]);
  }
  langKeys[lang] = keys;
}

const enKeys = langKeys["en"] || new Set();
const enBase = new Set([...enKeys].filter((k) => !k.endsWith("_plural")));

let hasErrors = false;

for (const lang of SUPPORTED_LANGS) {
  if (lang === "en") continue;
  const langSet = langKeys[lang] || new Set();
  const missing = [];
  const extra = [];

  for (const key of enBase) {
    if (!langSet.has(key) && !langSet.has(`${key}_plural`)) {
      // Check if there's a plural variant in en that this lang should also have
      const hasPluralInEn = enKeys.has(`${key}_plural`);
      if (!langSet.has(key)) {
        missing.push(key + (hasPluralInEn ? " (+ _plural)" : ""));
      }
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
