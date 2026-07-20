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
  "src/components/diary/LinkTargetFields.tsx": ["@/lib/db", "dexie-react-hooks"],
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
  "src/pages/Diary.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/EditStudyRoutinePage.tsx": ["@/lib/db"],
  "src/pages/EditTaskPage.tsx": ["@/lib/db"],
  "src/pages/History.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Index.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/ItemAnalysisPage.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Lessons.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Library.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/NewTaskPage.tsx": ["@/lib/db", "dexie-react-hooks"],
  "src/pages/Profile.tsx": ["dexie-react-hooks"],
  "src/pages/Tasks.tsx": ["@/lib/db"],
};

const restrictedImports = [
  { pattern: /from\s+["']@\/lib\/db(?:\/|["'])/, label: "@/lib/db" },
  { pattern: /from\s+["']dexie(?:["']|\/)/, label: "dexie" },
  { pattern: /from\s+["']dexie-react-hooks(?:["']|\/)/, label: "dexie-react-hooks" },
  { pattern: /from\s+["']@\/infrastructure(?:\/|["'])/, label: "@/infrastructure/" },
  { pattern: /from\s+["']@capacitor\/filesystem(?:["']|\/)/, label: "@capacitor/filesystem" },
];

const restrictedBrowserApis = [
  { pattern: /\bFileReader\b/, label: "FileReader" },
  { pattern: /\bBlob\b/, label: "Blob" },
  { pattern: /\bURL\.createObjectURL\b/, label: "URL.createObjectURL" },
];

async function filesIn(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name)
      ? [path]
      : [];
  }));
  return files.flat();
}

async function auditPresentationImports(): Promise<Record<string, string[]>> {
  const files = (await Promise.all(presentationRoots.map((root) => filesIn(join(sourceRoot, root))))).flat();
  const violations: Record<string, string[]> = {};

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const labels = [...restrictedImports, ...restrictedBrowserApis]
      .filter(({ pattern }) => pattern.test(source))
      .map(({ label }) => label);
    if (labels.length) violations[relative(process.cwd(), file)] = labels;
  }

  return violations;
}

describe("presentation import boundaries", () => {
  it("allows only documented legacy violations", async () => {
    expect(await auditPresentationImports()).toEqual(temporaryBaseline);
  });
});
