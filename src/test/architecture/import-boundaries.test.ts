import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const presentationRoots = ["pages", "components", "hooks", "presentation"];
const temporaryBaseline: Record<string, string[]> = {};

const restrictedImports = [
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)?["']@\/lib\/(?:presentationQueries|subscriptions)(?:["']|\/)/g, label: "legacy presentation alias" },
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']@\/lib\/db(?:\/|["'])/g, label: "@/lib/db" },
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']dexie(?:["']|\/)/g, label: "dexie" },
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']dexie-react-hooks(?:["']|\/)/g, label: "dexie-react-hooks" },
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']@\/infrastructure(?:\/|["'])/g, label: "@/infrastructure/" },
  { pattern: /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']@capacitor\/filesystem(?:["']|\/)/g, label: "@capacitor/filesystem" },
];

const restrictedBrowserApis = [
  { pattern: /\bFileReader\b/g, label: "FileReader" },
  { pattern: /\bBlob\b/g, label: "Blob" },
  { pattern: /\bURL\.createObjectURL\b/g, label: "URL.createObjectURL" },
];

describe("presentation import audit helpers", () => {
  it("detects side-effect, dynamic, and CommonJS restricted imports", () => {
    const source = [
      'import "@/lib/db";',
      'await import("dexie");',
      'require("@/infrastructure/dexie");',
    ].join("\n");

    expect(restrictedLabelsIn(source)).toEqual([
      "@/lib/db",
      "dexie",
      "@/infrastructure/",
    ]);
  });

  it("keeps repeated forbidden imports so a baseline cannot hide a new occurrence", () => {
    const source = [
      'import { db } from "@/lib/db";',
      'import { database } from "@/lib/db";',
    ].join("\n");

    expect(restrictedLabelsIn(source)).toEqual(["@/lib/db", "@/lib/db"]);
  });

  it("excludes spec files from production presentation audit", () => {
    expect(isProductionSourceFile("Widget.spec.tsx")).toBe(false);
  });
});

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return isProductionSourceFile(entry.name)
      ? [path]
      : [];
  }));
  return files.flat();
}

function isProductionSourceFile(filename: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filename) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

function restrictedLabelsIn(source: string): string[] {
  return [...restrictedImports, ...restrictedBrowserApis].flatMap(({ pattern, label }) =>
    Array.from(source.matchAll(pattern), () => label),
  );
}

async function auditPresentationImports(): Promise<Record<string, string[]>> {
  const files = (await Promise.all(presentationRoots.map((root) => filesIn(join(sourceRoot, root))))).flat();
  const violations: Record<string, string[]> = {};

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const labels = restrictedLabelsIn(source);
    if (labels.length) violations[relative(process.cwd(), file)] = labels;
  }

  return violations;
}

describe("presentation import boundaries", () => {
  it("allows only documented legacy violations", async () => {
    expect(await auditPresentationImports()).toEqual(temporaryBaseline);
  });
});

describe("library presentation boundary", () => {
  it("does not import legacy presentation query aliases", async () => {
    const files = [
      ...await filesIn(join(sourceRoot, "components", "library")),
      join(sourceRoot, "pages", "Library.tsx"),
      join(sourceRoot, "pages", "ItemPage.tsx"),
    ];
    const legacyAliases = /(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']@\/lib\/(?:presentationQueries|subscriptions)(?:["'])/;
    const offenders = (await Promise.all(files.map(async (file) => {
      const source = await readFile(file, "utf8");
      return legacyAliases.test(source) ? relative(process.cwd(), file) : null;
    }))).filter((file): file is string => file !== null);

    expect(offenders).toEqual([]);
  });
});
