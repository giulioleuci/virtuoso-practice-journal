#!/usr/bin/env node
/**
 * i18n validation script
 *
 * Checks:
 *   1. Parity — every English key exists in every supported language.
 *   2. Extras — keys present in a translation but not in English.
 *   3. Missing references — keys used in source code but absent from en.json.
 *   4. Unused keys — keys defined in en.json but never referenced in code.
 *
 * Usage: node scripts/validate-i18n.mjs [--allow-unused]
 * Exit code: 0 = all good, 1 = errors found.
 *
 * Supported call patterns (extracted from `src/**\/*.{ts,tsx}`):
 *   t("key.path")                     — static literal
 *   t('key.path')                     — static literal
 *   t(`key.path`)                     — static literal
 *   t(`prefix.${expr}`)               — dynamic; every en key starting with `prefix.`
 *                                       is considered referenced.
 *
 * An allow-list of key prefixes that should never be flagged as unused lives in
 * ALWAYS_USED_PREFIXES below (for keys built entirely at runtime).
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const langDir = join(root, "src/lib/language");
const srcDir = join(root, "src");

const SUPPORTED_LANGS = ["en", "it", "es", "de"];

// Prefixes that are always considered "used" — for keys assembled from
// runtime data (enum values, DB kinds, …) that a static scan cannot follow.
const ALWAYS_USED_PREFIXES = [
  "library.kind.",
  "common.days.",
  "common.months.",
  "intro.slide",
];

const args = new Set(process.argv.slice(2));
const allowUnused = args.has("--allow-unused");

// ---------- load translation files ----------
const langKeys = {};
for (const lang of SUPPORTED_LANGS) {
  const json = JSON.parse(readFileSync(join(langDir, `${lang}.json`), "utf-8"));
  langKeys[lang] = new Set(Object.keys(json));
}
const enKeys = langKeys["en"];
const enBase = new Set([...enKeys].filter((k) => !k.endsWith("_plural")));

// ---------- walk source tree ----------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === "language") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

const sourceFiles = walk(srcDir);

// Static: t("foo.bar"), t('foo.bar'), t(`foo.bar`)
const STATIC_RE = /\bt\(\s*(["'`])([a-zA-Z0-9_.-]+)\1/g;
// Dynamic template literal: t(`foo.bar.${...`
const DYNAMIC_RE = /\bt\(\s*`([a-zA-Z0-9_.-]*?)\$\{/g;

const usedStatic = new Set();
const usedPrefixes = new Set(ALWAYS_USED_PREFIXES);
const referencesByKey = new Map(); // key -> [file:line]

for (const file of sourceFiles) {
  const src = readFileSync(file, "utf-8");
  const rel = relative(root, file);

  let m;
  STATIC_RE.lastIndex = 0;
  while ((m = STATIC_RE.exec(src))) {
    const key = m[2];
    usedStatic.add(key);
    const line = src.slice(0, m.index).split("\n").length;
    if (!referencesByKey.has(key)) referencesByKey.set(key, []);
    referencesByKey.get(key).push(`${rel}:${line}`);
  }

  DYNAMIC_RE.lastIndex = 0;
  while ((m = DYNAMIC_RE.exec(src))) {
    const prefix = m[1];
    if (prefix) usedPrefixes.add(prefix);
  }
}

// ---------- 1 + 2: parity check ----------
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
    if (!enKeys.has(key) && !enKeys.has(base)) extra.push(key);
  }

  if (missing.length) {
    hasErrors = true;
    console.error(`\n[${lang}] Missing ${missing.length} key(s):`);
    for (const k of missing) console.error(`  - ${k}`);
  }
  if (extra.length) {
    console.warn(`\n[${lang}] Extra ${extra.length} key(s) not in English:`);
    for (const k of extra) console.warn(`  + ${k}`);
  }
  if (!missing.length && !extra.length) {
    console.log(`[${lang}] ✓ All keys present`);
  }
}

// ---------- 3: keys referenced in code but missing from en.json ----------
const missingRefs = [];
for (const key of usedStatic) {
  if (enKeys.has(key)) continue;
  // A reference to "foo.bar" is satisfied by "foo.bar_plural" alone too.
  if (enKeys.has(`${key}_plural`)) continue;
  missingRefs.push(key);
}
missingRefs.sort();
if (missingRefs.length) {
  hasErrors = true;
  console.error(`\n[code → en] Missing ${missingRefs.length} key(s) referenced in source:`);
  for (const k of missingRefs) {
    const ref = referencesByKey.get(k)?.[0] ?? "?";
    console.error(`  - ${k}  (${ref})`);
  }
}

// ---------- 4: keys defined in en.json but never referenced ----------
function isReferenced(key) {
  const base = key.endsWith("_plural") ? key.slice(0, -7) : key;
  if (usedStatic.has(base) || usedStatic.has(key)) return true;
  for (const prefix of usedPrefixes) {
    if (key.startsWith(prefix) || base.startsWith(prefix)) return true;
  }
  return false;
}

const unused = [...enKeys].filter((k) => !isReferenced(k)).sort();
if (unused.length) {
  if (allowUnused) {
    console.warn(`\n[en] Unused ${unused.length} key(s) (warn only, --allow-unused):`);
    for (const k of unused) console.warn(`  · ${k}`);
  } else {
    hasErrors = true;
    console.error(`\n[en] Unused ${unused.length} key(s) — remove them or add a reference:`);
    for (const k of unused) console.error(`  · ${k}`);
    console.error(`\n  (re-run with --allow-unused to downgrade this to a warning)`);
  }
}

if (hasErrors) {
  console.error("\n✗ i18n validation failed");
  process.exit(1);
} else {
  console.log("\n✓ i18n validation passed");
  process.exit(0);
}
