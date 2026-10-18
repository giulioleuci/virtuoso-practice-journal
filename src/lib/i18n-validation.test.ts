import { afterEach, expect, it } from "vitest";
import { closeSync, mkdtempSync, mkdirSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const fixtures: string[] = [];
afterEach(() => fixtures.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

async function validate(source: string, en: Record<string, string>, it = en, testSource = "") {
  const dir = mkdtempSync(join(tmpdir(), "virtuoso-i18n-"));
  fixtures.push(dir);
  mkdirSync(join(dir, "scripts"));
  mkdirSync(join(dir, "src/lib/language"), { recursive: true });
  symlinkSync(resolve("node_modules"), join(dir, "node_modules"), "dir");
  writeFileSync(join(dir, "scripts/validate-i18n.mjs"), readFileSync("scripts/validate-i18n.mjs"));
  for (const lang of ["en", "it", "es", "de"]) {
    writeFileSync(join(dir, `src/lib/language/${lang}.json`), JSON.stringify(lang === "it" ? it : en));
  }
  writeFileSync(join(dir, "src/app.ts"), source);
  writeFileSync(join(dir, "src/app.test.ts"), testSource);
  return new Promise<{ status: number | null; stderr: string }>((resolve, reject) => {
    const outputPath = join(dir, "output.log");
    const output = openSync(outputPath, "w");
    const child = spawn(process.execPath, [join(dir, "scripts/validate-i18n.mjs")], { stdio: ["ignore", output, output] });
    closeSync(output);
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stderr: readFileSync(outputPath, "utf8") }));
  });
}

it("rejects missing conditional keys and direct translate calls", async () => {
  const result = await validate('t(ok ? "toast.created" : "toast.updated"); translate(lang, "reminder.body");', {});
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("toast.created");
  expect(result.stderr).toContain("toast.updated");
  expect(result.stderr).toContain("reminder.body");
});

it("preserves indirect keys and both branches of conditional calls", async () => {
  const result = await validate('const key = "plan.subtitle"; t(key); t(ok ? "common.save" : "common.add");', {
    "plan.subtitle": "Plan", "common.save": "Save", "common.add": "Add",
  });
  expect(result.status, result.stderr).toBe(0);
});

it("rejects missing keys selected indirectly from a map", async () => {
  const result = await validate('const subtitle = { tasks: "plan.subtitle", routines: "plan.subtitleRoutines", calendar: "plan.subtitleCalendar" }[tab]; t(subtitle);', {});
  expect(result.status).toBe(1);
  for (const key of ["plan.subtitle", "plan.subtitleRoutines", "plan.subtitleCalendar"]) {
    expect(result.stderr).toContain(key);
  }
});

it("does not let test references or template prefixes hide unused keys", async () => {
  const result = await validate('t(`item.${id}.title`);', {
    "item.one.title": "Title", "item.one.body": "Body", "common.unused": "Unused",
  }, undefined, 't("common.unused");');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("item.one.body");
  expect(result.stderr).toContain("common.unused");
});

it("rejects missing plural forms, extra keys and mismatched placeholders", async () => {
  const result = await validate('t("items.count", { count: 2 }); t("hello", { name: "A" });', {
    "items.count": "{{count}} item", "items.count_plural": "{{count}} items", hello: "Hello {{name}}",
  }, { "items.count": "{{count}} elemento", hello: "Ciao {{nome}}", extra: "Extra" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("items.count_plural");
  expect(result.stderr).toContain("hello");
  expect(result.stderr).toContain("extra");
});
