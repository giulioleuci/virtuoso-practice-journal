import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");
const presentationRoots = ["pages", "components", "hooks"];
// Temporary migration baseline. Every entry must be removed with its vertical slice.
const temporaryBaseline: Record<string, string[]> = {
  "src/components/AppShell.tsx": ["@/lib/db"],
  "src/components/collections/AssignPiecesSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/collections/NewCollectionSheet.tsx": ["@/lib/db"],
  "src/components/diary/BpmSuggestion.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/EditTaskSheet.tsx": ["@/lib/db"],
  "src/components/diary/LastSessionStrip.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/LinkTargetFields.tsx": ["@/lib/db", "@/lib/db", "dexie-react-hooks"],
  "src/components/diary/PracticeMode.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/SegmentHistorySheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/SessionDetailSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/SessionFAB.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/SessionFields.tsx": ["@/lib/db"],
  "src/components/diary/SessionLogSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/StatsDashboard.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/StudyRoutineWizard.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/TaskCalendarView.tsx": ["@/lib/db"],
  "src/components/diary/TaskWizard.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/diary/recurrence-state.ts": ["@/lib/db"],
  "src/components/lessons/AddHomeworkSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/lessons/LessonLogSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/lessons/RecurrenceSheet.tsx": ["@/lib/db"],
  "src/components/lessons/TeacherRecapSheet.tsx": ["@/lib/db"],
  "src/components/library/BpmCoupler.tsx": ["@/lib/db"],
  "src/components/library/BpmSparkline.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/library/ItemAnalysisSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/library/ItemHelpSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/library/LibraryItemKindFields.tsx": ["@/lib/db"],
  "src/components/library/MasterySliders.tsx": ["@/lib/db"],
  "src/components/library/MasterySparkline.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/library/NewLibraryItemSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/library/SegmentsEditor.tsx": ["@/lib/db"],
  "src/components/library/TeacherAnswersSheet.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/components/onboarding/Onboarding.tsx": ["@/lib/db"],
  "src/components/profile/SubjectsEditor.tsx": ["@/lib/db"],
  "src/hooks/useEntities.ts": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Collections.tsx": ["@/lib/db"],
  "src/pages/Diary.tsx": ["@/lib/db", "@/lib/db", "dexie-react-hooks"],
  "src/pages/EditStudyRoutinePage.tsx": ["@/lib/db"],
  "src/pages/EditTaskPage.tsx": ["@/lib/db"],
  "src/pages/History.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Index.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/ItemAnalysisPage.tsx": ["@/lib/db", "@/lib/db", "dexie-react-hooks"],
  "src/pages/Lessons.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Library.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/NewTaskPage.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Profile.tsx": ["dexie-react-hooks"],
  "src/pages/Tasks.tsx": ["@/lib/db", "@/lib/db"],
};

const restrictedImports = [
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
