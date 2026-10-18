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
 * Uses the installed TypeScript parser to inspect literals, conditional calls,
 * indirect key declarations and dynamic templates without scanning comments/tests.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, relative } from "path";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const langDir = join(root, "src/lib/language");
const srcDir = join(root, "src");

const SUPPORTED_LANGS = ["en", "it", "es", "de"];

const args = new Set(process.argv.slice(2));
const allowUnused = args.has("--allow-unused");

// ---------- load translation files ----------
const langKeys = {};
const dictionaries = {};
for (const lang of SUPPORTED_LANGS) {
  const json = JSON.parse(readFileSync(join(langDir, `${lang}.json`), "utf-8"));
  dictionaries[lang] = json;
  langKeys[lang] = new Set(Object.keys(json));
}
const enKeys = langKeys["en"];

// ---------- walk source tree ----------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry === "language") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.[^.]+$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

const sourceFiles = walk(srcDir);
const program = ts.createProgram(sourceFiles, { noResolve: true, noLib: true });
const checker = program.getTypeChecker();

const usedStatic = new Set();
const usedPatterns = [];
const referencesByKey = new Map();
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const file of sourceFiles) {
  const source = program.getSourceFile(file);
  const rel = relative(root, file);
  const visitedKeys = new Set();

  function recordKey(node) {
    if (!node || visitedKeys.has(node)) return;
    visitedKeys.add(node);
    if (ts.isStringLiteralLike(node)) {
      usedStatic.add(node.text);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      if (!referencesByKey.has(node.text)) referencesByKey.set(node.text, []);
      referencesByKey.get(node.text).push(`${rel}:${line}`);
    } else if (ts.isConditionalExpression(node)) {
      recordKey(node.whenTrue);
      recordKey(node.whenFalse);
    } else if (ts.isParenthesizedExpression(node)) {
      recordKey(node.expression);
    } else if (ts.isIdentifier(node)) {
      const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration)) recordKey(declaration.initializer);
    } else if (ts.isElementAccessExpression(node)) {
      recordKey(node.expression);
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) recordKey(property.initializer);
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) recordKey(element);
    } else if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
      recordKey(node.expression);
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(source);
      if (name === "t") recordKey(node.arguments[0]);
      if (name === "translate") recordKey(node.arguments[1]);
    }
    // Key maps and variables passed to t() are also references.
    if (ts.isStringLiteralLike(node) && enKeys.has(node.text)) usedStatic.add(node.text);
    if (ts.isTemplateExpression(node) && node.head.text.includes(".")) {
      const chunks = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
      usedPatterns.push(new RegExp(`^${chunks.map(escapeRegex).join(".*")}$`));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

// ---------- 1 + 2: parity check ----------
let hasErrors = false;

for (const lang of SUPPORTED_LANGS) {
  if (lang === "en") continue;
  const langSet = langKeys[lang];
  const missing = [];
  const extra = [];

  for (const key of enKeys) {
    if (!langSet.has(key)) {
      missing.push(key);
    }
  }
  for (const key of langSet) {
    if (!enKeys.has(key)) extra.push(key);
  }

  if (missing.length) {
    hasErrors = true;
    console.error(`\n[${lang}] Missing ${missing.length} key(s):`);
    for (const k of missing) console.error(`  - ${k}`);
  }
  if (extra.length) {
    hasErrors = true;
    console.error(`\n[${lang}] Extra ${extra.length} key(s) not in English:`);
    for (const k of extra) console.error(`  + ${k}`);
  }
  for (const key of enKeys) {
    const value = dictionaries[lang][key];
    if (value === undefined) continue;
    const placeholders = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");
    if (typeof value !== "string" || !value.trim() || placeholders(value) !== placeholders(dictionaries.en[key])) {
      hasErrors = true;
      console.error(`[${lang}] Invalid value or mismatched placeholders: ${key}`);
    }
  }
  if (!missing.length && !extra.length) {
    console.log(`[${lang}] ✓ All keys present`);
  }
}

// ---------- 3: keys referenced in code but missing from en.json ----------
const missingRefs = [];
for (const key of usedStatic) {
  if (enKeys.has(key)) continue;
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
  for (const pattern of usedPatterns) {
    if (pattern.test(key) || pattern.test(base)) return true;
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
