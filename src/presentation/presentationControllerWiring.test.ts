import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applicationCommands } from "@/lib/applicationCommands";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("presentation controller wiring", () => {
  it("exposes application commands used by session, routine, and backup controllers", () => {
    expect(applicationCommands.sessions.log.execute).toBeTypeOf("function");
    expect(applicationCommands.routines.generate.execute).toBeTypeOf("function");
    expect(applicationCommands.routines.update.execute).toBeTypeOf("function");
    expect(applicationCommands.backups.export.execute).toBeTypeOf("function");
    expect(applicationCommands.backups.import.execute).toBeTypeOf("function");
  });

  it("keeps controller-backed presentation features free of legacy persistence services", () => {
    for (const path of [
      "../pages/SessionLogPage.tsx",
      "../components/diary/RoutineBuilder.tsx",
      "../pages/Profile.tsx",
    ]) {
      expect(source(path)).not.toMatch(/\b(?:studyRoutinesService|sessionsService|backupService)\b/);
    }
  });
});
