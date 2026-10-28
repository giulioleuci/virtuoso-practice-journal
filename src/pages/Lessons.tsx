import { lazy, Suspense, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { ChevronRight, HelpCircle, Plus, Wand2 } from "lucide-react";
import { useActiveTasks, useAssignments, useOpenHelpRequestCount } from "@/presentation/hooks/useEntities";
import type { LessonRecurrence } from "@/domain/entities/lesson";
import { assignmentsToPlan } from "@/presentation/utils/assignments";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionTabs } from "@/components/shared/ProgressTabs";
import { RecurrenceSheet } from "@/components/lessons/RecurrenceSheet";
import { UpcomingLessons } from "@/components/lessons/UpcomingLessons";
import { RecordedLessons } from "@/components/lessons/RecordedLessons";
import { TeachersList } from "@/components/lessons/TeachersList";

const TeacherRecapSheet = lazy(() => import("@/components/lessons/TeacherRecapSheet").then(module => ({ default: module.TeacherRecapSheet })));

/** Lessons area: upcoming, recorded and teachers are subpages under one header. */
export default function Lessons() {
  const { t } = useI18n();
  const pending = assignmentsToPlan(useAssignments(), useActiveTasks()).length;
  const openHelpCount = useOpenHelpRequestCount();

  const [recOpen, setRecOpen] = useState(false);
  const [editingRec, setEditingRec] = useState<LessonRecurrence | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapSubjectId, setRecapSubjectId] = useState<number | undefined>();

  const openRec = (r: LessonRecurrence | null = null) => { setEditingRec(r); setRecOpen(true); };
  const openRecap = (subjectId?: number) => { setRecapSubjectId(subjectId); setRecapOpen(true); };

  return (
    <div className="pb-24">
      <PageHeader
        title={t("nav.lessons")}
        actions={<>
          <Button variant="outline" onClick={() => openRecap()}>
            <HelpCircle /> {t("lessons.recap")}
            {openHelpCount ? <span className="rounded-full bg-primary px-1.5 py-0.5 font-numeric text-xs text-primary-foreground">{openHelpCount}</span> : null}
          </Button>
          <Button onClick={() => openRec()}><Plus /> {t("lessons.addRecurrence")}</Button>
        </>}
      />

      {pending > 0 && (
        <Link to="/lessons/assignments" className="mb-5 flex items-center gap-3 border-y border-primary/30 py-3 text-sm font-medium text-primary hover:bg-primary/5">
          <Wand2 className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{t("lessons.assignments", { count: pending })}</span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
      )}

      <SectionTabs label={t("lessons.tabs")} tabs={[["/lessons", t("lessons.upcoming")], ["/lessons/recorded", t("lessons.recent")], ["/lessons/teachers", t("lessons.teachers")]]} />

      <Routes>
        <Route index element={<UpcomingLessons onAddTeacher={() => openRec()} onQuestions={openRecap} />} />
        <Route path="recorded" element={<RecordedLessons />} />
        <Route path="teachers" element={<TeachersList onAdd={() => openRec()} onEdit={openRec} />} />
      </Routes>

      <RecurrenceSheet open={recOpen} onOpenChange={(o) => { setRecOpen(o); if (!o) setEditingRec(null); }} recurrence={editingRec} />

      {recapOpen && <Suspense fallback={<ResponsiveSheet open onOpenChange={setRecapOpen} title={t("recap.title")} description={t("recap.subtitle")}><p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p></ResponsiveSheet>}>
        <TeacherRecapSheet open onOpenChange={setRecapOpen} subjectId={recapSubjectId} />
      </Suspense>}
    </div>
  );
}
