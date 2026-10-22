import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const domainRoot = path.resolve(__dirname);
const prohibitedImports = [
  /from\s+["']react["']/,
  /from\s+["']dexie(?:-[^"']+)?["']/,
  /from\s+["'][^"']*\/lib\/db["']/,
  /\bwindow\s*(?:\.|\[)/,
  /\bdocument\b/,
  /\bnavigator\b/,
];

async function sourceFilesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFilesIn(entryPath);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [entryPath] : [];
  }));
  return files.flat();
}

describe("domain boundaries", () => {
  it("contains extracted contract modules", async () => {
    const files = await sourceFilesIn(domainRoot);
    const relativeFiles = files.map((file) => path.relative(domainRoot, file)).sort();

    expect(relativeFiles).toEqual(expect.arrayContaining([
      "constants/theoryLayers.ts",
      "entities/common.ts",
      "entities/task.ts",
      "entities/session.ts",
      "entities/library.ts",
      "entities/lesson.ts",
      "entities/collection.ts",
      "entities/profile.ts",
      "ports/task.ts",
      "ports/session.ts",
      "ports/library.ts",
      "ports/lesson.ts",
      "ports/collection.ts",
      "ports/profile.ts",
      "ports/backup.ts",
    ]));
  });

  it("keeps domain contracts free of framework, persistence, and browser APIs", async () => {
    const sources = await Promise.all((await sourceFilesIn(domainRoot)).map((file) => readFile(file)));
    const violations = sources.flatMap((source) => {
      const text = source.toString();
      return prohibitedImports.filter((pattern) => pattern.test(text)).map(String);
    });

    expect(violations).toEqual([]);
  });

  it("models completed session logging as one persisted-task workflow", async () => {
    const source = await readFile(path.join(domainRoot, "ports/session.ts"), "utf8");

    expect(source).toContain("export type PersistedTask = Task & { id: number };");
    expect(source).toContain("log(task: Task, date: string, input");
    expect(source).toContain("helpText?: string;");
    expect(source).toContain("transaction<T>(operation: (transaction: SessionLogTransaction) => Promise<T>): Promise<T>;");
    expect(source).toContain("createSession(session: Omit<Session, \"id\">): Promise<number>;");
    expect(source).toContain("syncTaskDone(taskId: number): Promise<void>;");
  });

  it("preserves library removal outcome", async () => {
    const source = await readFile(path.join(domainRoot, "ports/library.ts"), "utf8");

    expect(source).toContain('remove(id: number): Promise<"soft" | "hard">;');
  });
});
